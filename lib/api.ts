/**
 * lib/api.ts — Sagana Rider
 *
 * Shared axios instance + auth token management (trimmed from the main
 * sagana-frontend lib/api.ts). Endpoint functions (reviews, preorders,
 * buyer features) are intentionally omitted — the rider app has its own
 * API clients in lib/riderOrdersApi.ts, lib/riderSettingsApi.ts,
 * lib/riderProfileApi.ts, and lib/routingApi.ts.
 *
 * Auth token lives in SecureStore (iOS Keychain / Android Keystore) via the
 * secureStorage wrapper, with AsyncStorage as a fallback. Non-secret data
 * (user object, expiration timestamp) stays in AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";
import { secureStorage } from "../utils/secureStorage";

/**
 * Storage keys for auth. Matches the main app so a token issued by either
 * app is interchangeable (same backend, same Sanctum tokens table).
 */
const AUTH_TOKEN_KEY = "auth_token";
const AUTH_EXPIRES_KEY = "auth_token_expires_at";

// Function to get the API base URL
function getBaseUrl() {
  // Priority 1: Check for environment variable (for EAS builds and testing)
  const envUrl =
    process.env.EXPO_PUBLIC_API_URL || process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.trim()) {
    const cleanUrl = envUrl.trim();
    // Ensure URL ends with /api
    if (cleanUrl.endsWith("/api")) {
      return cleanUrl;
    } else {
      // Add /api if not present, but remove trailing slash first
      return `${cleanUrl.replace(/\/$/, "")}/api`;
    }
  }

  // Priority 2: Local Docker backend (default for development)
  return "http://localhost:8000/api";
}

const resolvedBaseUrl = getBaseUrl();
// Log the resolved base URL for debugging (development only)
try {
  if (__DEV__) {
    console.log(
      `[API] Using base URL: ${resolvedBaseUrl} (platform=${Platform.OS}, dev=${__DEV__})`,
    );
  }
} catch {}

const api = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 60000, // 60s — Render free tier cold-start can take 30-50s
  headers: {
    Accept: "application/json",
    // DO NOT set Content-Type in defaults - let interceptor handle it per request
  },
});

api.interceptors.request.use(async (config) => {
  // Initialize headers if not present
  if (!config.headers) {
    config.headers = {} as any;
  }

  // Enforce token expiration and set Authorization
  try {
    const [token, expiresAt] = await Promise.all([
      secureStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_EXPIRES_KEY),
    ]);

    if (token && expiresAt) {
      const now = Date.now();
      const expMs = Date.parse(expiresAt);
      if (!Number.isNaN(expMs) && now >= expMs) {
        // Token expired: clear and avoid attaching it
        await Promise.all([
          secureStorage.removeItem(AUTH_TOKEN_KEY),
          AsyncStorage.multiRemove([AUTH_EXPIRES_KEY, "user", "user_id"]),
        ]);
      } else if (token) {
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    } else if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {}

  // Handle FormData LAST - after Authorization is set.
  // In React Native, FormData must have Content-Type removed for axios
  // to set multipart/form-data.
  const isFormData =
    config.data instanceof FormData ||
    (config.data &&
      typeof config.data === "object" &&
      (config.data.constructor?.name === "FormData" ||
        (config.data as any)._parts !== undefined ||
        (config.data as any)._blob !== undefined));

  if (isFormData) {
    // Get Authorization and Accept from existing headers before resetting
    const authHeader =
      (config.headers as any)["Authorization"] ||
      (config.headers as any)["authorization"];
    const acceptHeader =
      (config.headers as any)["Accept"] ||
      (config.headers as any)["accept"] ||
      "application/json";

    // CRITICAL: Prevent axios from transforming FormData
    // This is essential for PUT/PATCH requests with FormData in React Native
    config.transformRequest = [];

    // CRITICAL: Delete Content-Type from request config headers
    if (config.headers) {
      delete (config.headers as any)["Content-Type"];
      delete (config.headers as any)["content-type"];
      delete (config.headers as any)["Content-type"];
    }

    // Also delete from common defaults
    if (api.defaults.headers.common) {
      delete (api.defaults.headers.common as any)["Content-Type"];
      delete (api.defaults.headers.common as any)["content-type"];
    }

    // Delete from method-specific defaults (PUT, POST, etc.)
    const method = (config.method || "get").toLowerCase();
    if (api.defaults.headers[method]) {
      delete (api.defaults.headers[method] as any)["Content-Type"];
      delete (api.defaults.headers[method] as any)["content-type"];
    }

    // CRITICAL: Replace entire headers object to ensure NO Content-Type exists
    const requestHeaders = config.headers || {};
    const mergedHeaders: any = {
      Accept: acceptHeader,
      ...(authHeader ? { Authorization: authHeader } : {}),
    };

    // Copy other headers from request config (except Content-Type)
    Object.keys(requestHeaders).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== "content-type" && lowerKey !== "contenttype") {
        mergedHeaders[key] = (requestHeaders as any)[key];
      }
    });

    config.headers = mergedHeaders as any;

    // Force delete Content-Type one more time after merging
    delete (config.headers as any)["Content-Type"];
    delete (config.headers as any)["content-type"];
  } else {
    // For non-FormData requests, ensure Content-Type is set to application/json
    if (
      !(config.headers as any)["Content-Type"] &&
      !(config.headers as any)["content-type"]
    ) {
      (config.headers as any)["Content-Type"] = "application/json";
    }
  }

  // Dev logging (passwords masked)
  try {
    if (__DEV__) {
      const method = (config.method || "GET").toUpperCase();
      const url = `${config.baseURL || ""}${config.url || ""}`;
      const headers: any = { ...(config.headers as any) };
      if (headers && headers.Authorization)
        headers.Authorization = "Bearer ***";
      console.log(`[API][REQUEST] ${method} ${url}`, {
        timeout: config.timeout,
        headers,
        data: config.data
          ? (() => {
              const safe = { ...(config.data as any) };
              if (safe.password) safe.password = "***";
              return safe;
            })()
          : config.data,
      });
    }
  } catch {}
  return config;
});

// Enhanced error handling interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const method = error?.config?.method?.toUpperCase();
    const url = `${error?.config?.baseURL || ""}${error?.config?.url || ""}`;

    // Check for network errors (timeout, connection refused, etc.)
    const isNetworkError =
      !error.response &&
      (error.code === "ECONNABORTED" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ENOTFOUND" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error") ||
        error.message?.includes("timeout") ||
        error.message?.includes("Network request failed") ||
        error.message?.includes("Failed to fetch"));

    if (isNetworkError) {
      error.networkError = true;
      if (error.code === "ETIMEDOUT" || error.code === "ECONNABORTED") {
        error.userMessage =
          "Server is taking too long to respond. Please try again later or contact support.";
      } else if (error.code === "ENOTFOUND") {
        error.userMessage =
          "Cannot resolve server address. Please check your internet connection.";
      } else if (error.code === "ECONNREFUSED") {
        error.userMessage =
          "Connection refused by server. The backend server may be down. Please try again later.";
      } else {
        error.userMessage =
          "Cannot reach server. Please check your internet connection and try again.";
      }
    }

    // Log errors
    try {
      console.log(
        `[API][ERROR] ${method} ${url} -> ${status || "NETWORK_ERROR"}`,
        {
          message: error?.message,
          code: error?.code,
          networkError: isNetworkError,
        },
      );
    } catch {}

    // Handle 401 errors
    if (error.response?.status === 401) {
      // Only clear if the backend explicitly says expired (matches main app
      // behavior — some endpoints legitimately 401 with a valid token).
      const code = error?.response?.data?.code || "";
      const message: string = error?.response?.data?.message || "";
      const isExpired =
        /expired|token.*expired/i.test(message) || code === "TOKEN_EXPIRED";
      if (isExpired) {
        await Promise.all([
          secureStorage.removeItem(AUTH_TOKEN_KEY),
          AsyncStorage.multiRemove([AUTH_EXPIRES_KEY, "user", "user_id"]),
        ]);
        delete api.defaults.headers.common["Authorization"];
      }
    }

    // On a 401 that isn't an auth request, try a one-shot token refresh.
    // Concurrent 401s share a single refresh call via getOrStartRefresh().
    if (
      error.response?.status === 401 &&
      !error.config?._isRetry &&
      !error.config?.url?.includes("/auth/refresh") &&
      !error.config?.url?.includes("/rider/login")
    ) {
      try {
        const newToken = await getOrStartRefresh();
        if (newToken) {
          // Retry the original request once with the new token
          const retryConfig = {
            ...error.config,
            _isRetry: true,
            headers: {
              ...(error.config?.headers || {}),
              Authorization: `Bearer ${newToken}`,
            },
          };
          return api.request(retryConfig);
        }
      } catch {
        // fall through to reject
      }
    }

    return Promise.reject(error);
  },
);

// Restore token on app start
export async function restoreAuth() {
  try {
    const [token, expiresAt] = await Promise.all([
      secureStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_EXPIRES_KEY),
    ]);

    if (token && expiresAt) {
      const now = new Date().getTime();
      let expirationTime: number;

      // Handle both timestamp strings and date strings
      const parsedTimestamp = parseInt(expiresAt, 10);
      if (!isNaN(parsedTimestamp) && parsedTimestamp > 0) {
        expirationTime = parsedTimestamp;
      } else {
        const parsedDate = Date.parse(expiresAt);
        if (!isNaN(parsedDate) && parsedDate > 0) {
          expirationTime = parsedDate;
        } else {
          // Invalid expiration, clear token
          if (__DEV__) {
            console.log("⚠️ API: Invalid expiration format, clearing token");
          }
          await setAuthToken(null);
          return false;
        }
      }

      // Check if token is still valid (with 5 minute buffer)
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      if (now < expirationTime - bufferTime) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        if (__DEV__) {
          console.log("✅ API: Auth token restored successfully");
        }
        return true;
      } else {
        // Token expired or about to expire, clear it
        if (__DEV__) {
          console.log("⚠️ API: Auth token expired, clearing");
        }
        await setAuthToken(null);
        return false;
      }
    } else {
      if (__DEV__) {
        console.log("❌ API: No valid auth token found");
      }
      return false;
    }
  } catch (error) {
    console.error("❌ API: Error restoring auth", error);
    return false;
  }
}

// Save or remove token.
// Default expiration: 24h. The backend sends a 60-day expires_at with the
// rider login response, which overrides this default.
export async function setAuthToken(
  token: string | null,
  expiresAt?: string | number | null,
  expiresInDays: number = 1,
) {
  if (token) {
    let expirationTime: number;

    if (expiresAt) {
      if (typeof expiresAt === "string") {
        const parsedDate = Date.parse(expiresAt);
        if (!isNaN(parsedDate)) {
          expirationTime = parsedDate;
        } else {
          expirationTime = parseInt(expiresAt, 10);
        }
      } else {
        expirationTime = expiresAt;
      }

      if (isNaN(expirationTime) || expirationTime <= 0) {
        expirationTime =
          new Date().getTime() + expiresInDays * 24 * 60 * 60 * 1000;
      }
    } else {
      expirationTime =
        new Date().getTime() + expiresInDays * 24 * 60 * 60 * 1000;
    }

    await Promise.all([
      secureStorage.setItem(AUTH_TOKEN_KEY, token),
      AsyncStorage.setItem(AUTH_EXPIRES_KEY, expirationTime.toString()),
    ]);

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    if (__DEV__) {
      console.log(
        `✅ API: Auth token saved (expires at: ${new Date(expirationTime).toISOString()})`,
      );
    }
  } else {
    await Promise.all([
      secureStorage.removeItem(AUTH_TOKEN_KEY),
      AsyncStorage.removeItem(AUTH_EXPIRES_KEY),
    ]);

    delete api.defaults.headers.common["Authorization"];

    if (__DEV__) {
      console.log("✅ API: Auth token cleared");
    }
  }
}

/**
 * Try to refresh the access token using the backend's /auth/refresh endpoint.
 * Returns the new token on success, or null on failure. The 401 retry logic
 * in the response interceptor calls this once before giving up.
 *
 * Note: the Sagana backend does not currently implement /auth/refresh —
 * this returns null and the user is sent to the login screen on the next
 * 401, same as the main app. Kept for forward-compatibility.
 */
export async function tryRefreshToken(): Promise<string | null> {
  try {
    const response = await axios.post(
      `${resolvedBaseUrl}/auth/refresh`,
      {},
      {
        timeout: 10_000,
        headers: { Accept: "application/json" },
      },
    );
    const newToken: string | undefined = response.data?.token;
    const newExpiresAt: string | number | undefined =
      response.data?.expires_at;
    if (newToken) {
      await setAuthToken(newToken, newExpiresAt ?? null);
      if (__DEV__) console.log("[API] Token refreshed successfully");
      return newToken;
    }
    return null;
  } catch (e) {
    if (__DEV__) console.log("[API] tryRefreshToken failed:", e);
    return null;
  }
}

/** In-flight refresh promise so concurrent 401s share a single refresh call. */
let refreshInFlight: Promise<string | null> | null = null;
export function getOrStartRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = tryRefreshToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export default api;