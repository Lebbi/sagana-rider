import { describe, expect, it, jest } from "@jest/globals";
import type { ReactTestRenderer } from "react-test-renderer";

const mockInject = jest.fn<(script: string) => void>();

jest.mock("react-native-webview", () => {
  const R = require("react");
  const WebView = R.forwardRef((props: Record<string, unknown>, ref: unknown) => {
    R.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
    return R.createElement("WebView", props);
  });
  return { __esModule: true, WebView };
});
jest.mock("../leafletSource", () => ({ LEAFLET_CSS: "", LEAFLET_JS: "" }));
jest.mock("@/constants/IconTheme", () => ({ MaterialIcons: "Icon" }));
jest.mock("@/lib/i18n", () => ({ useT: () => (key: string) => key }));

process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY = "test-carto-key";
const { act, create } = require("react-test-renderer");
const RiderNavigationWebView = require("../RiderNavigationWebView").default;

const farm = { latitude: 15.03, longitude: 120.69 };
const buyer = { latitude: 15.05, longitude: 120.7 };
const rider = { latitude: 15.04, longitude: 120.695 };
const route = { polyline: [rider, buyer], totalDistance: 1200, totalDuration: 300, steps: [] };

describe("RiderNavigationWebView", () => {
  it("draws a route, farm stop and rider that arrived before the map was ready", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <RiderNavigationWebView
          route={route}
          riderLocation={rider}
          riderHeading={90}
          destination={buyer}
          destinationType="delivery"
          extraStops={[{ point: farm, type: "pickup" }]}
          isDarkMode={false}
        />,
      );
    });
    expect(mockInject).not.toHaveBeenCalled();

    const webView = tree.root.findByType("WebView" as never);
    act(() => {
      webView.props.onMessage({ nativeEvent: { data: JSON.stringify({ type: "mapReady" }) } });
    });

    const sent = mockInject.mock.calls.map(([script]) => script).join("\n");
    expect(sent).toContain('window.updateRoute({"polyline":[{"latitude":15.04');
    expect(sent).toContain('window.setExtraStops([{"lat":15.03,"lng":120.69,"type":"pickup"}])');
    expect(sent).toContain("window.updateRiderPosition(15.04, 120.695, 90)");
    act(() => tree.unmount());
  });

  it("puts the map key on the CARTO tile URL in the page", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <RiderNavigationWebView
          route={null}
          riderLocation={null}
          riderHeading={null}
          destination={buyer}
          destinationType="delivery"
          isDarkMode={false}
        />,
      );
    });
    const html: string = tree.root.findByType("WebView" as never).props.source.html;
    expect(html).toContain("basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=test-carto-key");
    act(() => tree.unmount());
  });
});
