import { describe, it, expect } from "vitest";
import {
  edgeStyle,
  environmentClass,
  mostPermeableConnection,
  needsAnnotation,
  trustTint,
} from "../map/styling";
import type { ConnectionOut, EdgeOut } from "../api/types";

describe("trust / environment styling map (§2.5)", () => {
  it("maps trust to a tint token, null → unknown", () => {
    expect(trustTint("private")).toBe("private");
    expect(trustTint("shared")).toBe("shared");
    expect(trustTint("public")).toBe("public");
    expect(trustTint(null)).toBe("unknown");
  });

  it("maps environment to a styling token, null → unknown", () => {
    expect(environmentClass("indoor")).toBe("indoor");
    expect(environmentClass("outdoor")).toBe("outdoor");
    expect(environmentClass("semi_outdoor")).toBe("semi_outdoor");
    expect(environmentClass(null)).toBe("unknown");
  });

  it("flags a fully-null area as needing annotation", () => {
    expect(needsAnnotation({ type: null, environment: null, trust: null })).toBe(true);
    expect(needsAnnotation({ type: "kitchen", environment: null, trust: null })).toBe(false);
  });
});

describe("edge style picks the most-permeable connection (§2.5)", () => {
  const connections: ConnectionOut[] = [
    { passage: "none", barrier: "solid" },
    { passage: "stairs", barrier: "open" },
    { passage: "level", barrier: "door" },
  ];

  it("selects the open barrier over door and solid", () => {
    const best = mostPermeableConnection(connections);
    expect(best?.barrier).toBe("open");
    expect(best?.passage).toBe("stairs");
  });

  it("derives the edge style + glyph from the most-permeable connection", () => {
    const edge = { connections, is_perimeter: true } as Pick<EdgeOut, "connections" | "is_perimeter">;
    const style = edgeStyle(edge);
    expect(style.barrier).toBe("open");
    expect(style.glyph).toBe("stairs");
    expect(style.perimeter).toBe(true);
  });

  it("degrades an empty bundle to a solid, glyph-less style", () => {
    const style = edgeStyle({ connections: [], is_perimeter: false });
    expect(style).toEqual({ barrier: "solid", passage: "none", glyph: "", perimeter: false });
  });
});
