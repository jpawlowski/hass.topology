/**
 * Deterministic 2D layout for the per-floor map (Phase 7 §2.5). v1 is the cheap,
 * faithful render: positions are seeded deterministically by `area_id` so a floor
 * renders stably across reloads. The degree-sized procedural massing master §7
 * calls "the hard part" is explicitly v2+ and lives nowhere in this file.
 *
 * Pure and Lit-free (§4.2, D15): the read-only render path and a future card
 * reuse this unchanged. `Math.random` is never used — layout must be a pure
 * function of the input ids for stable, testable output.
 */

export interface Point {
  x: number;
  y: number;
}

/** FNV-1a hash of a string → unsigned 32-bit int (deterministic seed source). */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface LayoutOptions {
  /** Logical canvas width (viewBox units). */
  width: number;
  /** Logical canvas height (viewBox units). */
  height: number;
  /** Margin kept clear of node centers on every side. */
  margin: number;
}

const DEFAULT_OPTIONS: LayoutOptions = { width: 1000, height: 700, margin: 90 };

/**
 * Lay out `areaIds` on a stable grid, then apply a small deterministic per-node
 * jitter (seeded by the id hash) so equal-degree nodes do not overlap perfectly.
 * The result is a map from `area_id` to a center point in viewBox units.
 *
 * Sorting the ids first makes the grid assignment independent of input order —
 * two snapshots with the same id set always produce the same layout.
 */
export function computeLayout(
  areaIds: readonly string[],
  options: Partial<LayoutOptions> = {},
): Map<string, Point> {
  const { width, height, margin } = { ...DEFAULT_OPTIONS, ...options };
  const ids = [...areaIds].sort();
  const result = new Map<string, Point>();
  const count = ids.length;
  if (count === 0) {
    return result;
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const usableWidth = width - 2 * margin;
  const usableHeight = height - 2 * margin;
  const cellWidth = columns > 1 ? usableWidth / (columns - 1) : 0;
  const cellHeight = rows > 1 ? usableHeight / (rows - 1) : 0;

  ids.forEach((areaId, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const seed = hashString(areaId);
    // Jitter in [-0.18, 0.18) of a cell, deterministic per id.
    const jitterX = ((seed & 0xffff) / 0xffff - 0.5) * 0.36;
    const jitterY = (((seed >>> 16) & 0xffff) / 0xffff - 0.5) * 0.36;
    const baseX = columns > 1 ? margin + column * cellWidth : width / 2;
    const baseY = rows > 1 ? margin + row * cellHeight : height / 2;
    result.set(areaId, {
      x: baseX + jitterX * (cellWidth || usableWidth),
      y: baseY + jitterY * (cellHeight || usableHeight),
    });
  });

  return result;
}
