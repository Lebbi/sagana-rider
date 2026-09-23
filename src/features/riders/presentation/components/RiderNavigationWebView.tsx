/**
 * src/features/riders/presentation/components/RiderNavigationWebView.tsx
 *
 * Live Leaflet map for rider navigation. Replaces the static PNG image
 * in ActiveDeliveryPage.tsx.
 *
 * Features:
 * - CARTO Dark Matter / Positron tiles (themed to match app)
 * - Route polyline in Sagana green, animated draw on load
 * - Rider marker: motorcycle icon, rotates with heading, smooth interpolation
 * - Destination marker: farmer icon (pickup) or home icon (delivery) with pulse
 * - Auto-center on rider, auto-zoom to show rider + destination
 * - Communication bridge via WebView postMessage / injectJavaScript
 *
 * @see docs/maps-implementation-plan.md
 */

import { MaterialIcons } from "@/constants/IconTheme";
import {
    SAGANA_MAP_COLORS,
    TILE_LAYERS,
    getMapColors,
    getTileStyle,
} from "@/lib/mapTiles";
import type { GeoPoint, RouteResponse } from "@/types/maps";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

// Bundled Leaflet 1.9.4 (downloaded from unpkg, stored locally to eliminate
// CDN dependency + SRI risk — D2 finding 4 security hardening).
// On native, expo-asset resolves these to local file:// URIs that the
// WebView can load via <script src>. On web, they resolve to the bundler URL.
const leafletJsAsset = Asset.fromModule(require("@/assets/leaflet/leaflet.js"));
const leafletCssAsset = Asset.fromModule(require("@/assets/leaflet/leaflet.css"));

// ============================================================
// Props
// ============================================================

export interface RiderNavigationWebViewProps {
  /** Route from OSRM (polyline + steps + ETA). Null while loading. */
  route: RouteResponse | null;
  /** Current rider GPS position. Updates every ~3s. */
  riderLocation: GeoPoint | null;
  /** Compass heading in degrees (0-360). Null if unavailable. */
  riderHeading: number | null;
  /** Current destination (farmer for pickup, buyer for delivery). */
  destination: GeoPoint;
  /** "pickup" shows farmer icon, "delivery" shows home icon. */
  destinationType: "pickup" | "delivery";
  /** Match app theme — switches CARTO dark/light tiles. */
  isDarkMode: boolean;
  /** Called when the map is ready to receive commands. */
  onMapReady?: () => void;
}

// ============================================================
// Component
// ============================================================

export default function RiderNavigationWebView({
  route,
  riderLocation,
  riderHeading,
  destination,
  destinationType,
  isDarkMode,
  onMapReady,
}: RiderNavigationWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [leafletUris, setLeafletUris] = useState<{ js: string; css: string } | null>(null);

  // Load bundled Leaflet assets (downloads to local cache on first run).
  // This replaces the CDN <script src="unpkg.com"> with local file:// URIs,
  // eliminating the supply-chain + SRI risk (D2 finding 4).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([leafletJsAsset.downloadAsync(), leafletCssAsset.downloadAsync()]);
        if (!mounted) return;
        setLeafletUris({
          js: leafletJsAsset.localUri || leafletJsAsset.uri,
          css: leafletCssAsset.localUri || leafletCssAsset.uri,
        });
      } catch (e) {
        if (__DEV__) console.warn("[RiderNavigationWebView] Failed to load Leaflet assets:", e);
        // Fallback: use the remote URIs (better than no map)
        if (mounted) setLeafletUris({
          js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
          css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const tileStyle = getTileStyle(isDarkMode);
  const tileConfig = TILE_LAYERS[tileStyle];
  const colors = getMapColors(isDarkMode);

  // Fallback static map after 5 seconds if WebView is completely dead
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading && !isReadyRef.current) {
        setShowFallback(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // ----------------------------------------------------------
  // Generate the HTML for the WebView
  // ----------------------------------------------------------

  const mapHTML = leafletUris ? generateMapHTML({
    tileConfig,
    colors,
    destination,
    destinationType,
    isDarkMode,
    leafletJsUri: leafletUris.js,
    leafletCssUri: leafletUris.css,
  }) : "";

  // ----------------------------------------------------------
  // Send route to WebView when it changes
  // ----------------------------------------------------------

  useEffect(() => {
    if (!route || !webViewRef.current || !isReadyRef.current) return;

    const jsCode = `
      if (window.updateRoute) {
        window.updateRoute(${JSON.stringify({
          polyline: route.polyline,
          totalDistance: route.totalDistance,
          totalDuration: route.totalDuration,
        })});
      }
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [route]);

  // ----------------------------------------------------------
  // Send rider location + heading to WebView when it changes
  // ----------------------------------------------------------

  useEffect(() => {
    if (!riderLocation || !webViewRef.current || !isReadyRef.current) return;

    const jsCode = `
      if (window.updateRiderPosition) {
        window.updateRiderPosition(${riderLocation.latitude}, ${riderLocation.longitude}, ${riderHeading ?? "null"});
      }
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [riderLocation, riderHeading]);

  // ----------------------------------------------------------
  // Send destination to WebView when it changes (phase switch)
  // ----------------------------------------------------------

  useEffect(() => {
    if (!webViewRef.current || !isReadyRef.current) return;

    const jsCode = `
      if (window.updateDestination) {
        window.updateDestination(${destination.latitude}, ${destination.longitude}, "${destinationType}");
      }
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, [destination, destinationType]);

  // ----------------------------------------------------------
  // Handle messages from WebView
  // ----------------------------------------------------------

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "mapReady") {
          isReadyRef.current = true;
          setIsLoading(false);
          setHasError(false);
          if (__DEV__) {
            console.log("[RiderNavigationWebView] Map is ready!");
          }
          onMapReady?.();
        } else if (data.type === "log") {
          if (__DEV__) {
            console.log(`[WebView] ${data.message}`);
          }
        } else if (data.type === "error") {
          if (__DEV__) {
            console.error(`[WebView Error] ${data.message}`);
          }
          setHasError(true);
          setIsLoading(false);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("[RiderNavigationWebView] Failed to parse message:", e);
        }
      }
    },
    [onMapReady],
  );

  return (
    <View style={styles.container}>
      {!leafletUris && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.routeLine} />
        </View>
      )}
      {leafletUris && (
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        androidLayerType="software"
        // Security hardening (D2 finding 4):
        // - originWhitelist: only allow about:blank (inline HTML source)
        // - onShouldStartLoadWithRequest: block ALL external navigation
        // - mixedContentMode removed (default = 'compatibility' on Android)
        originWhitelist={["about:blank"]}
        onShouldStartLoadWithRequest={(request) => {
          // Only allow the initial inline HTML (about:blank) and local file://
          if (request.url.startsWith("about:blank") || request.url.startsWith("file://")) {
            return true;
          }
          // Block everything else (external links, malicious redirects)
          return false;
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => {
          setIsLoading(false);
          setShowFallback(false);
        }}
        onError={(e) => {
          if (__DEV__) {
            console.error(
              "[RiderNavigationWebView] WebView error:",
              e.nativeEvent,
            );
          }
          setHasError(true);
          setIsLoading(false);
          setShowFallback(true);
        }}
        renderError={() => (
          <View style={styles.errorContainer}>
            <MaterialIcons name="cloud-off" size={40} color="#8ecb95" />
            <Text style={styles.errorText}>Map failed to load</Text>
            <Text style={styles.errorSubtext}>
              Check your internet connection
            </Text>
          </View>
        )}
      />
      )}
      {isLoading && !showFallback && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#8ecb95" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
      {showFallback && (
        <View style={styles.fallbackOverlay}>
          <View style={styles.fallbackPlaceholder}>
            <MaterialIcons name="map" size={48} color="#8ecb95" />
            <Text style={styles.fallbackTitle}>Map preview unavailable</Text>
            <Text style={styles.fallbackSubtext}>
              Destination: {destination.latitude.toFixed(4)},{" "}
              {destination.longitude.toFixed(4)}
            </Text>
          </View>
          <View style={styles.fallbackBadge}>
            <MaterialIcons name="cloud-off" size={16} color="#8ecb95" />
            <Text style={styles.fallbackText}>Live map is loading slowly</Text>
          </View>
        </View>
      )}
      {hasError && !isLoading && !showFallback && (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="cloud-off" size={40} color="#8ecb95" />
          <Text style={styles.errorText}>Map failed to load</Text>
          <Text style={styles.errorSubtext}>
            Check your internet connection
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================
// HTML Generator
// ============================================================

function generateMapHTML({
  tileConfig,
  colors,
  destination,
  destinationType,
  isDarkMode,
  leafletJsUri,
  leafletCssUri,
}: {
  tileConfig: {
    url: string;
    attribution: string;
    subdomains?: string;
    maxZoom: number;
  };
  colors: typeof SAGANA_MAP_COLORS.light | typeof SAGANA_MAP_COLORS.dark;
  destination: GeoPoint;
  destinationType: "pickup" | "delivery";
  isDarkMode: boolean;
  leafletJsUri: string;
  leafletCssUri: string;
}): string {
  const destIconHTML =
    destinationType === "pickup"
      ? // Farmer/pickup icon — green circle with "P"
        `<div style="background: ${colors.pickupMarker}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid ${colors.pickupMarkerBorder}; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.4);">
           <span style="color: ${colors.pickupMarkerBorder}; font-weight: bold; font-size: 18px;">P</span>
         </div>`
      : // Delivery/home icon — green pin
        `<div style="background: ${colors.deliveryMarker}; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4);">
           <div style="width: 10px; height: 10px; background: white; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
         </div>`;

  const riderIconHTML = `<div style="background: ${colors.riderMarker}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.5); transition: transform 0.3s ease-out;" id="rider-icon-inner">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
             <path d="M19 17h2c.6 0 1-.4 1-1l-1.5-5c-.2-.6-.8-1-1.4-1H15"/>
             <path d="M5 17H3c-.6 0-1-.4-1-1l1.5-5c.2-.6.8-1 1.4-1H9"/>
             <circle cx="6.5" cy="17.5" r="2.5"/>
             <circle cx="17.5" cy="17.5" r="2.5"/>
           </svg>
         </div>`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=0.5, user-scalable=yes">
    <link rel="stylesheet" href="${leafletCssUri}" />
    <style>
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body {
        margin: 0; padding: 0; width: 100%; height: 100%;
        overflow: hidden; position: fixed;
        background: ${isDarkMode ? "#0f150f" : "#ffffff"};
      }
      #map { width: 100vw; height: 100vh; position: absolute; top: 0; left: 0; }
      .leaflet-container {
        -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
        touch-action: pan-x pan-y pinch-zoom;
        background: ${isDarkMode ? "#0f150f" : "#ffffff"};
      }
      /* Route line animation */
      .route-line {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: drawRoute 0.8s ease-out forwards;
      }
      @keyframes drawRoute {
        to { stroke-dashoffset: 0; }
      }
      /* Destination pulse */
      .destination-pulse {
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.4); opacity: 0.3; }
        100% { transform: scale(1); opacity: 0.7; }
      }
      /* Rider marker transition */
      .rider-marker {
        transition: transform 0.3s ease-out;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="${leafletJsUri}"></script>
    <script>
      // ============================================================
      // Console log forwarding — sends WebView logs to React Native
      // ============================================================
      const originalLog = console.log;
      const originalError = console.error;
      console.log = function() {
        const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg })); } catch(e) {}
        originalLog.apply(console, arguments);
      };
      console.error = function() {
        const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg })); } catch(e) {}
        originalError.apply(console, arguments);
      };
      window.addEventListener('error', function(e) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno })); } catch(err) {}
      });
      window.addEventListener('unhandledrejection', function(e) {
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Promise rejected: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason)) })); } catch(err) {}
      });

      // ============================================================
      // Map initialization
      // ============================================================
      if (typeof L === 'undefined') {
        document.getElementById('map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#8ecb95;font-family:sans-serif;font-size:14px;text-align:center;padding:20px;">Map library failed to load. Check your internet connection.</div>';
        try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Leaflet library failed to load from CDN' })); } catch(e) {}
      } else {
        initMap();
      }

      function initMap() {
      const map = L.map('map', {
        center: [${destination.latitude}, ${destination.longitude}],
        zoom: 15,
        minZoom: 3, maxZoom: 19,
        zoomControl: false,
        dragging: true, touchZoom: true, scrollWheelZoom: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false,
        tap: true, tapTolerance: 15,
        trackResize: true, inertia: true,
        inertiaDeceleration: 2400, inertiaMaxSpeed: 1200,
        zoomAnimation: true, fadeAnimation: true,
        markerZoomAnimation: true, preferCanvas: false
      });

      // Add themed tiles
      L.tileLayer('${tileConfig.url}', {
        attribution: '${tileConfig.attribution}',
        ${tileConfig.subdomains ? `subdomains: '${tileConfig.subdomains}',` : ""}
        maxZoom: ${tileConfig.maxZoom},
        tileSize: 256, crossOrigin: true,
        updateWhenIdle: false, updateWhenZooming: true, keepBuffer: 2
      }).addTo(map);

      // Invalidate size after load
      setTimeout(() => { map.invalidateSize(); }, 200);

      // ============================================================
      // Markers
      // ============================================================

      // Destination marker with pulse
      const destIcon = L.divIcon({
        className: 'destination-marker',
        html: '<div class="destination-pulse" style="position: relative;">${destIconHTML.replace(/'/g, "\\'")}<div style="position: absolute; top: -8px; left: -8px; width: 56px; height: 56px; border-radius: 50%; border: 2px solid ${colors.destinationPulse}; opacity: 0.4; animation: pulse 2s infinite;"></div></div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      let destMarker = L.marker([${destination.latitude}, ${destination.longitude}], {
        icon: destIcon
      }).addTo(map);

      // Rider marker (starts at destination until first GPS fix)
      const riderIcon = L.divIcon({
        className: 'rider-marker',
        html: '${riderIconHTML.replace(/'/g, "\\'")}',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      let riderMarker = null;
      let riderCurrentPos = null;
      let riderTargetPos = null;
      let riderCurrentHeading = 0;
      let animationFrameId = null;

      // ============================================================
      // Route polyline
      // ============================================================
      let routePolyline = null;
      let routeOutlinePolyline = null;

      // ============================================================
      // Smooth marker interpolation
      // ============================================================
      function animateRiderMarker() {
        if (!riderCurrentPos || !riderTargetPos || !riderMarker) return;

        const latDiff = riderTargetPos.lat - riderCurrentPos.lat;
        const lngDiff = riderTargetPos.lng - riderCurrentPos.lng;

        // If close enough, snap to target
        if (Math.abs(latDiff) < 0.00001 && Math.abs(lngDiff) < 0.00001) {
          riderCurrentPos = { lat: riderTargetPos.lat, lng: riderTargetPos.lng };
          animationFrameId = null;
          return;
        }

        // Interpolate 15% of the way each frame (~60fps → ~0.5s to reach)
        riderCurrentPos.lat += latDiff * 0.15;
        riderCurrentPos.lng += lngDiff * 0.15;

        riderMarker.setLatLng([riderCurrentPos.lat, riderCurrentPos.lng]);

        // Auto-center map on rider
        map.panTo([riderCurrentPos.lat, riderCurrentPos.lng], { animate: true, duration: 0.3 });

        animationFrameId = requestAnimationFrame(animateRiderMarker);
      }

      // ============================================================
      // Functions called from React Native (via injectJavaScript)
      // ============================================================

      // Update route polyline
      window.updateRoute = function(routeData) {
        // Remove old route
        if (routePolyline) { map.removeLayer(routePolyline); }
        if (routeOutlinePolyline) { map.removeLayer(routeOutlinePolyline); }

        if (!routeData || !routeData.polyline || routeData.polyline.length === 0) return;

        const latlngs = routeData.polyline.map(p => [p.latitude, p.longitude]);

        // Outline (darker, thicker)
        routeOutlinePolyline = L.polyline(latlngs, {
          color: '${colors.routeLineOutline}',
          weight: 8,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Main route line (Sagana green)
        routePolyline = L.polyline(latlngs, {
          color: '${colors.routeLine}',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'route-line'
        }).addTo(map);

        // Fit map to show entire route
        if (latlngs.length > 1) {
          const bounds = L.latLngBounds(latlngs);
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17, animate: true, duration: 0.5 });
        }
      };

      // Update rider position (called every ~3s from GPS)
      window.updateRiderPosition = function(lat, lng, heading) {
        riderTargetPos = { lat: lat, lng: lng };

        if (!riderMarker) {
          // First GPS fix — create marker
          riderCurrentPos = { lat: lat, lng: lng };
          riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
          map.setView([lat, lng], 16, { animate: true, duration: 0.5 });
        }

        // Update heading rotation
        if (heading !== null && heading !== undefined) {
          riderCurrentHeading = heading;
          const iconElement = riderMarker.getElement();
          if (iconElement) {
            const innerDiv = iconElement.querySelector('#rider-icon-inner');
            if (innerDiv) {
              innerDiv.style.transform = 'rotate(' + heading + 'deg)';
            }
          }
        }

        // Start smooth animation
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(animateRiderMarker);
        }
      };

      // Update destination (phase switch: pickup → delivery)
      window.updateDestination = function(lat, lng, type) {
        if (destMarker) { map.removeLayer(destMarker); }

        let iconHTML;
        if (type === 'pickup') {
          iconHTML = '<div style="background: ${colors.pickupMarker}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid ${colors.pickupMarkerBorder}; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(0,0,0,0.4);"><span style="color: ${colors.pickupMarkerBorder}; font-weight: bold; font-size: 18px;">P</span></div>';
        } else {
          iconHTML = '<div style="background: ${colors.deliveryMarker}; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4);"><div style="width: 10px; height: 10px; background: white; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div></div>';
        }

        const newIcon = L.divIcon({
          className: 'destination-marker',
          html: '<div class="destination-pulse" style="position: relative;">' + iconHTML + '<div style="position: absolute; top: -8px; left: -8px; width: 56px; height: 56px; border-radius: 50%; border: 2px solid ${colors.destinationPulse}; opacity: 0.4; animation: pulse 2s infinite;"></div></div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        destMarker = L.marker([lat, lng], { icon: newIcon }).addTo(map);
      };

      // ============================================================
      // Notify React Native that map is ready
      // ============================================================
      setTimeout(() => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
      }, 500);

      } // end initMap()
    </script>
  </body>
</html>`;
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    backgroundColor: "#0C111B",
  },
  webview: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0C111B",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12, 17, 27, 0.9)",
    gap: 12,
  },
  loadingText: {
    color: "#8ecb95",
    fontSize: 14,
    fontFamily: "StackSansHeadline_500Medium",
  },
  errorOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C111B",
    gap: 8,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C111B",
    gap: 8,
  },
  errorText: {
    color: "#8ecb95",
    fontSize: 16,
    fontFamily: "StackSansHeadline_600SemiBold",
  },
  errorSubtext: {
    color: "#999",
    fontSize: 12,
    fontFamily: "StackSansHeadline_400Regular",
  },
  fallbackOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C111B",
    gap: 12,
  },
  fallbackPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fallbackTitle: {
    color: "#8ecb95",
    fontSize: 16,
    fontFamily: "StackSansHeadline_600SemiBold",
  },
  fallbackSubtext: {
    color: "#666",
    fontSize: 12,
    fontFamily: "StackSansHeadline_400Regular",
  },
  fallbackBadge: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fallbackText: {
    color: "#8ecb95",
    fontSize: 12,
    fontFamily: "StackSansHeadline_500Medium",
  },
});
