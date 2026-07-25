import { describe, it, expect } from "vitest";
import { parseRoute } from "../router";

describe("router parses the ?focus= deep-link query (§2.2)", () => {
  it("resolves every focus scope to its view", () => {
    expect(parseRoute("?focus=unannotated")).toEqual({ view: "map", focus: "unannotated" });
    expect(parseRoute("?focus=isolated")).toEqual({ view: "map", focus: "isolated" });
    expect(parseRoute("?focus=floors")).toEqual({ view: "floors", focus: "floors" });
    expect(parseRoute("?focus=bearings")).toEqual({ view: "map", focus: "bearings" });
    // The exterior scope flags on the map like the other area scopes; it has no
    // view of its own (the old "exterior" view rendered nothing).
    expect(parseRoute("?focus=exterior")).toEqual({ view: "map", focus: "exterior" });
    expect(parseRoute("?focus=orphans")).toEqual({ view: "orphans", focus: "orphans" });
  });

  it("defaults to the map view for an absent query", () => {
    expect(parseRoute("")).toEqual({ view: "map", focus: null });
  });

  it("defaults to the map view for an unknown scope", () => {
    expect(parseRoute("?focus=bananas")).toEqual({ view: "map", focus: null });
  });

  it("accepts a bare query without the leading ?", () => {
    expect(parseRoute("focus=isolated")).toEqual({ view: "map", focus: "isolated" });
  });
});
