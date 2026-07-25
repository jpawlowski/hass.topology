/**
 * Deterministic 2D layout for the map (Phase 7 §2.5). v1 is the cheap, faithful
 * render: no geometry is stored, so the layout is a pure function of the areas
 * and their floors. The degree-sized procedural massing master §7 calls "the hard
 * part" is explicitly v2+ and lives nowhere in this file.
 *
 * Areas are grouped into one horizontal band per floor, bands stacked in the
 * order given — the caller passes floors top-down — so the picture already shows
 * which rooms sit above which before a single connection has been declared. That
 * ordering is the only thing floor levels are used for here; the level number
 * itself is never drawn.
 *
 * Within a band, input order is preserved: that is the order the user created
 * their areas in Home Assistant, which is more meaningful than any sort this
 * module could invent.
 *
 * Pure and Lit-free (§4.2, D15): the read-only render path and a future card
 * reuse this unchanged. `Math.random` is never used — the layout must be a pure
 * function of its input for stable, testable output.
 */

export interface Point {
  x: number;
  y: number;
}

/** One area to place, with the floor that groups it (`null` = unfloored). */
export interface LayoutNode {
  areaId: string;
  floorId: string | null;
}

/** A floor's horizontal band, for the caller to label and tint. */
export interface LayoutBand {
  floorId: string | null;
  /** Top edge of the band in viewBox units. */
  y: number;
  height: number;
}

/** A rectangle in viewBox units — also the shape of an SVG `viewBox`. */
export interface Extent {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  positions: Map<string, Point>;
  bands: LayoutBand[];
  /**
   * Bounding box of everything drawn, padding included. Used directly as the
   * `viewBox`, which is what guarantees no node can fall outside the visible
   * area regardless of how many areas or floors there are.
   */
  extent: Extent;
}

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  /** Horizontal gap between two node boxes. */
  gapX: number;
  /** Vertical gap between two rows inside one band. */
  rowGap: number;
  /** Vertical gap between two floor bands. */
  bandGap: number;
  /** Padding kept around the whole drawing. */
  padding: number;
  /** Most nodes on one row before wrapping to a second row in the same band. */
  maxColumns: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  nodeWidth: 150,
  nodeHeight: 64,
  gapX: 32,
  rowGap: 24,
  bandGap: 56,
  padding: 40,
  maxColumns: 5,
};

/** Split a band's nodes into rows of at most `maxColumns`. */
function chunkRows<T>(items: T[], maxColumns: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const columns = Math.min(items.length, Math.max(1, maxColumns));
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * Lay out `nodes` as one band per floor, stacked in `floorOrder`.
 *
 * `floorOrder` lists floor ids top-down (the order `list_annotations` ships).
 * Floors absent from it, and unfloored areas, are appended at the bottom — there
 * is nothing to place them relative to. Bands are centred on a common axis so
 * the stack reads as a section through the building.
 */
export function computeLayout(
  nodes: readonly LayoutNode[],
  floorOrder: readonly string[] = [],
  options: Partial<LayoutOptions> = {},
): LayoutResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const positions = new Map<string, Point>();
  const bands: LayoutBand[] = [];

  if (nodes.length === 0) {
    return {
      positions,
      bands,
      extent: { x: 0, y: 0, width: opts.nodeWidth, height: opts.nodeHeight },
    };
  }

  const byFloor = new Map<string | null, LayoutNode[]>();
  for (const node of nodes) {
    const key = node.floorId;
    const bucket = byFloor.get(key);
    if (bucket === undefined) {
      byFloor.set(key, [node]);
    } else {
      bucket.push(node);
    }
  }

  // Known floors in the caller's order first, then anything left over (a floor
  // with no level, or unfloored areas) in first-seen order.
  const orderedKeys: (string | null)[] = [];
  for (const floorId of floorOrder) {
    if (byFloor.has(floorId)) {
      orderedKeys.push(floorId);
    }
  }
  for (const key of byFloor.keys()) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  // Widest row across all bands sets the common centre line.
  let widestRow = 1;
  for (const key of orderedKeys) {
    for (const row of chunkRows(byFloor.get(key) ?? [], opts.maxColumns)) {
      widestRow = Math.max(widestRow, row.length);
    }
  }
  const contentWidth = widestRow * opts.nodeWidth + (widestRow - 1) * opts.gapX;
  const centreX = opts.padding + contentWidth / 2;

  let y = opts.padding;
  for (const key of orderedKeys) {
    const rows = chunkRows(byFloor.get(key) ?? [], opts.maxColumns);
    const bandTop = y;
    for (const row of rows) {
      const rowWidth = row.length * opts.nodeWidth + (row.length - 1) * opts.gapX;
      let x = centreX - rowWidth / 2;
      for (const node of row) {
        positions.set(node.areaId, { x: x + opts.nodeWidth / 2, y: y + opts.nodeHeight / 2 });
        x += opts.nodeWidth + opts.gapX;
      }
      y += opts.nodeHeight + opts.rowGap;
    }
    // Trade the trailing row gap for the wider band gap.
    y = y - opts.rowGap + opts.bandGap;
    bands.push({ floorId: key, y: bandTop, height: y - opts.bandGap - bandTop });
  }

  const totalHeight = y - opts.bandGap + opts.padding;
  return {
    positions,
    bands,
    extent: {
      x: 0,
      y: 0,
      width: contentWidth + 2 * opts.padding,
      height: totalHeight,
    },
  };
}
