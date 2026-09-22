// context/UserContext.tsx — Sagana Rider
//
// Rider-specific user context, adapted from the main app's UserContext.
// Trimmed for the rider app:
//  - No seller relationship (riders are never sellers in this app)
//  - No address CRUD (rider pickup/delivery addresses come from orders,
//    not from a rider-maintained address book)
//  - Keeps `rider` + `role` fields returned by POST /api/rider/login
//
// Token restore: the auth token lives in SecureStore; the user object is
// cached in AsyncStorage for fast (offline) restore, then refreshed from
// GET /api/user in the background. On 401 the session is cleared and the
// app falls back to the login screen.

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useRouter } from "expo-router";

import { secureStorage } from "../utils/secureStorage";

export type RiderInfo = {
  id: number;
  user_id: number;
  phone_number?: string | null;
  vehicle_type?: string | null;
  vehicle_plate_number?: string | null;
  license_number?: string | null;
  status?: string | null;
};

export type User = {
  id: number;
  name: string;
  email: string;
  profile_image?: string | null;
  phone_number?: string | null;
  rider?: RiderInfo | null;
  role?: "buyer" | "seller" | "admin" | "driver" | string;
};

type Updater = (prev: User | null) => User | null;

type UserContextType = {
  user: User | null;
  // accept either a new user or a function updater like useState
  setUser: (user: User | null | Updater | undefined) => void;
  logout: () => void;
  loadingUser: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        // First, restore the auth token
        const token = await secureStorage.getItem("auth_token");
        const expiresAt = await AsyncStorage.getItem("auth_token_expires_at");
        if (token) {
          // Restore the token in API headers without overwriting expiration
          const api = (await import("../lib/api")).default;
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          if (!expiresAt) {
            const { setAuthToken } = await import("../lib/api");
            await setAuthToken(token); // Will calculate default expiration
          }

          // Check for stored user data first (faster, works offline)
          const storedUser = await AsyncStorage.getItem("user");
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUserState(parsedUser);

              if (__DEV__)
                console.log("✅ UserContext: Restored user from storage");
            } catch (parseError) {
              if (__DEV__)
                console.warn(
                    "⚠️ UserContext: Failed to parse stored user",
                    parseError,
                );
            }
          }

          // Try to fetch fresh user data from server with timeout (in background)
          try {
            const api = (await import("../lib/api")).default;

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("User data request timeout")),
                    5000,
                ),
            );

            const apiPromise = api.get("/user");
            const response = (await Promise.race([
                apiPromise,
                timeoutPromise,
            ])) as any;
            const freshUser = response.data;

            // Update user state with fresh data
            setUserState(freshUser);

            // Update stored user data
            await AsyncStorage.setItem("user", JSON.stringify(freshUser));

            if (__DEV__)
                console.log(
                    "✅ UserContext: Successfully refreshed user from server",
                );
          } catch (apiError: any) {
            // If API call fails, keep using stored user data if available
            // Only clear auth if we get a 401 (unauthorized) which means
            // token is invalid
            if (apiError?.response?.status === 401) {
              // Token is invalid, clear everything
              const { setAuthToken } = await import("../lib/api");
              await setAuthToken(null);
              await AsyncStorage.multiRemove([
                "auth_token",
                "auth_token_expires_at",
                "user",
                "user_id",
              ]);
              setUserState(null);

              if (__DEV__)
                console.log("❌ UserContext: Token invalid (401), cleared auth");
            } else {
              if (__DEV__)
                console.log(
                    "⚠️ UserContext: API unavailable, using stored user data",
                );
            }
          }
        } else {
          // No token, clear any stored user data
          await AsyncStorage.removeItem("user");
          setUserState(null);

          if (__DEV__)
            console.log("❌ UserContext: No auth token found, user not logged in");
        }
      } catch (err) {
        if (__DEV__) console.error("❌ UserContext: Failed to load user", err);

        // Only clear auth if it's a critical error
        const storedUser = await AsyncStorage.getItem("user");
        const token = await secureStorage.getItem("auth_token");

        if (!token) {
          // No token, clear everything
          try {
            const { setAuthToken } = await import("../lib/api");
            await setAuthToken(null);
            await AsyncStorage.removeItem("user");
            setUserState(null);
          } catch (clearError) {
            if (__DEV__)
              console.error("❌ UserContext: Failed to clear auth", clearError);
          }
        } else if (storedUser) {
          // We have a token and stored user, try to restore
          try {
            const parsedUser = JSON.parse(storedUser);
            setUserState(parsedUser);
            const { setAuthToken } = await import("../lib/api");
            await setAuthToken(token);
          } catch (restoreError) {
            if (__DEV__)
              console.error(
                  "❌ UserContext: Failed to restore from storage",
                  restoreError,
              );
          }
        }
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, []);

  const setUser = useCallback(
    (nextUser: User | null | Updater | undefined) => {
      if (typeof nextUser === "function") {
        setUserState((prev) => nextUser(prev));
      } else {
        setUserState(nextUser ?? null);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // Call backend logout to revoke tokens (best effort)
      const api = (await import("../lib/api")).default;
      await api.post("/logout").catch(() => {});
    } finally {
      const { setAuthToken } = await import("../lib/api");
      await setAuthToken(null);
      await AsyncStorage.multiRemove([
        "auth_token",
        "auth_token_expires_at",
        "user",
        "user_id",
      ]);
      setUserState(null);

      // Redirect to login screen — without navigation the user is stuck
      // on the protected profile tab after the alert is dismissed.
      try {
        router.replace("/login" as never);
      } catch (navError) {
        if (__DEV__)
          console.warn("⚠️ UserContext: Failed to navigate to login", navError);
      }
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      logout,
      loadingUser,
    }),
    [user, setUser, logout, loadingUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};