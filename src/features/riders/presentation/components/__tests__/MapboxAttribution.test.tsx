import { describe, expect, it, jest } from "@jest/globals";
import React from "react";
import { Linking } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import MapboxAttribution from "@/features/riders/presentation/components/MapboxAttribution";

describe("MapboxAttribution", () => {
  it("shows the logo and opens each credit link (Mapbox Product Terms §1.4)", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<MapboxAttribution />);
    });

    expect(tree.root.findAll((n) => n.props.accessibilityRole === "image" && n.props.accessibilityLabel === "Mapbox").length).toBeGreaterThan(0);
    const texts = tree.root.findAll((n) => typeof n.props.children === "string").map((n) => n.props.children);
    expect(texts).toEqual(expect.arrayContaining(["© Mapbox", "© OpenStreetMap", "Improve this map"]));

    const links = tree.root.findAll((n) => n.props.accessibilityRole === "link" && typeof n.props.onPress === "function");
    const seen = new Set<string>();
    for (const link of links) {
      await act(async () => link.props.onPress());
      seen.add(open.mock.calls.at(-1)![0] as string);
    }
    expect([...seen].sort()).toEqual([
      "https://apps.mapbox.com/feedback/",
      "https://www.mapbox.com/about/maps/",
      "https://www.openstreetmap.org/copyright",
    ]);
  });
});
