import { describe, it, expect } from "vitest";
import { computeLayout, type LayoutNode } from "../map/layout";

const NODE_WIDTH = 150;
const NODE_HEIGHT = 64;

/** Every node box must sit inside the reported extent — the old bug, guarded. */
function expectAllInsideExtent(nodes: LayoutNode[], floorOrder: string[] = []): void {
  const { positions, extent } = computeLayout(nodes, floorOrder);
  expect(positions.size).toBe(nodes.length);
  for (const [areaId, point] of positions) {
    const left = point.x - NODE_WIDTH / 2;
    const right = point.x + NODE_WIDTH / 2;
    const top = point.y - NODE_HEIGHT / 2;
    const bottom = point.y + NODE_HEIGHT / 2;
    expect(left, `${areaId} left edge`).toBeGreaterThanOrEqual(extent.x);
    expect(right, `${areaId} right edge`).toBeLessThanOrEqual(extent.x + extent.width);
    expect(top, `${areaId} top edge`).toBeGreaterThanOrEqual(extent.y);
    expect(bottom, `${areaId} bottom edge`).toBeLessThanOrEqual(extent.y + extent.height);
  }
}

const node = (areaId: string, floorId: string | null = null): LayoutNode => ({ areaId, floorId });

describe("map layout keeps every area inside the drawn area", () => {
  it("fits a single area", () => {
    expectAllInsideExtent([node("a", "eg")], ["eg"]);
  });

  // The reported symptom: with only a couple of rooms the old jitter was scaled
  // by the cell size, which pushed boxes far outside a fixed viewBox.
  it("fits two and three areas on one floor", () => {
    expectAllInsideExtent([node("a", "eg"), node("b", "eg")], ["eg"]);
    expectAllInsideExtent([node("a", "eg"), node("b", "eg"), node("c", "eg")], ["eg"]);
  });

  it("fits a wrapped band and several floors at once", () => {
    const nodes = [
      ...Array.from({ length: 7 }, (_, i) => node(`dg${i}`, "dg")),
      ...Array.from({ length: 3 }, (_, i) => node(`og${i}`, "og")),
      node("garden", null),
    ];
    expectAllInsideExtent(nodes, ["dg", "og"]);
  });

  it("returns an empty result for no areas without producing a zero-sized box", () => {
    const { positions, bands, extent } = computeLayout([]);
    expect(positions.size).toBe(0);
    expect(bands).toEqual([]);
    expect(extent.width).toBeGreaterThan(0);
    expect(extent.height).toBeGreaterThan(0);
  });
});

describe("map layout stacks floors in the order it is given", () => {
  it("places an upper floor above a lower one", () => {
    // floorOrder is top-down, as `list_annotations` ships it.
    const { positions } = computeLayout([node("attic", "dg"), node("hall", "eg")], ["dg", "eg"]);
    expect(positions.get("attic")!.y).toBeLessThan(positions.get("hall")!.y);
  });

  it("emits one band per floor, in the same order", () => {
    const { bands } = computeLayout(
      [node("a", "dg"), node("b", "og"), node("c", "eg")],
      ["dg", "og", "eg"],
    );
    expect(bands.map((band) => band.floorId)).toEqual(["dg", "og", "eg"]);
    // Bands must not overlap, or two floors would draw on top of each other.
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].y).toBeGreaterThanOrEqual(bands[i - 1].y + bands[i - 1].height);
    }
  });

  it("puts floors missing from the order, and unfloored areas, at the bottom", () => {
    const { positions } = computeLayout(
      [node("shed", null), node("hall", "eg"), node("odd", "unlisted")],
      ["eg"],
    );
    expect(positions.get("hall")!.y).toBeLessThan(positions.get("shed")!.y);
    expect(positions.get("hall")!.y).toBeLessThan(positions.get("odd")!.y);
  });

  it("keeps areas of one floor on a common row", () => {
    const { positions } = computeLayout([node("a", "eg"), node("b", "eg")], ["eg"]);
    expect(positions.get("a")!.y).toBe(positions.get("b")!.y);
  });
});

describe("map layout is deterministic and order-preserving", () => {
  it("returns identical positions for identical input", () => {
    const nodes = [node("a", "eg"), node("b", "eg"), node("c", "og")];
    const first = computeLayout(nodes, ["og", "eg"]);
    const second = computeLayout(nodes, ["og", "eg"]);
    expect([...second.positions]).toEqual([...first.positions]);
  });

  // Areas arrive in the order the user created them in Home Assistant, which is
  // more meaningful than sorting by id — the old layout sorted and lost it.
  it("lays a band out left-to-right in input order", () => {
    const { positions } = computeLayout([node("zulu", "eg"), node("alpha", "eg")], ["eg"]);
    expect(positions.get("zulu")!.x).toBeLessThan(positions.get("alpha")!.x);
  });
});
