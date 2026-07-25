"""
Generate the `home-assistant/brands` icons for topology.

The brands repository takes finished PNGs, not source art, so the mark is
defined here as code: it makes the icon reproducible, reviewable in a diff, and
adjustable without a binary editor. Run it from the repository root:

    .venv/bin/python assets/brands/generate.py

Output: ``assets/brands/custom_integrations/topology/icon.png`` (256x256) and
``icon@2x.png`` (512x512) — the exact paths and sizes the brands repository
expects, so submitting is a directory copy.

**The mark.** A section through a building: three storey slabs seen edge-on,
with the adjacency graph drawn on them — nodes on each storey, a horizontal
edge between two rooms, and a vertical connector climbing all three. That is
literally what the integration models, and it reads at 32 px because it is four
shapes.

**Constraints this file exists to keep** (`home-assistant/brands` README):

- Square, PNG, transparent background, optimized for a white background.
- **No Home-Assistant-branded imagery.** A custom integration borrowing the HA
  mark would imply it is official. Nothing here derives from HA's logo.
- Not an MDI glyph either: the panel's `mdi:home-floor-g` sidebar icon is
  someone else's artwork under someone else's licence, and a brand icon has to
  be an original design.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Rendered at 8x and downsampled — cheap, reliable antialiasing without pulling
# in a vector toolchain for four rectangles and five circles.
SUPERSAMPLE = 8
BASE = 256

SLAB = (46, 64, 87, 255)  # dark slate — the storeys
GRAPH = (63, 167, 150, 255)  # teal — the adjacency drawn on them

OUT_DIR = Path(__file__).parent / "custom_integrations" / "topology"


def _draw(size: int) -> Image.Image:
    """Draw the mark at ``size`` px, supersampled."""
    scale = size * SUPERSAMPLE / BASE
    canvas = Image.new("RGBA", (size * SUPERSAMPLE, size * SUPERSAMPLE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    def px(value: float) -> float:
        return value * scale

    # Three storey slabs, evenly stacked. Margins are generous: the icon is
    # shown at 32 px in the HACS list, where edge-to-edge artwork looks cramped.
    slab_x0, slab_x1 = px(34), px(222)
    slab_height = px(20)
    slab_ys = [px(52), px(118), px(184)]
    for y in slab_ys:
        draw.rounded_rectangle(
            (slab_x0, y, slab_x1, y + slab_height),
            radius=slab_height / 2,
            fill=SLAB,
        )

    # The vertical connector — the stair that makes the storeys one graph. Drawn
    # first so the nodes sit on top of it.
    stair_x = px(90)
    draw.line(
        (stair_x, slab_ys[0] + slab_height / 2, stair_x, slab_ys[2] + slab_height / 2),
        fill=GRAPH,
        width=int(px(10)),
    )

    # One horizontal edge, on the middle storey: two rooms next to each other.
    draw.line(
        (stair_x, slab_ys[1] + slab_height / 2, px(176), slab_ys[1] + slab_height / 2),
        fill=GRAPH,
        width=int(px(10)),
    )

    # Nodes: the areas. One per storey on the stair, plus the room the middle
    # edge leads to.
    node_r = px(17)
    nodes = [
        (stair_x, slab_ys[0] + slab_height / 2),
        (stair_x, slab_ys[1] + slab_height / 2),
        (stair_x, slab_ys[2] + slab_height / 2),
        (px(176), slab_ys[1] + slab_height / 2),
    ]
    for cx, cy in nodes:
        draw.ellipse((cx - node_r, cy - node_r, cx + node_r, cy + node_r), fill=GRAPH)
        inner = node_r * 0.42
        draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=(255, 255, 255, 255))

    return canvas.resize((size, size), Image.LANCZOS)


def main() -> None:
    """Write both required sizes."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
        image = _draw(size)
        path = OUT_DIR / name
        # optimize=True keeps the files well under the size the brands review
        # asks for without touching the pixels.
        image.save(path, "PNG", optimize=True)
        print(f"{path} — {image.size[0]}x{image.size[1]}")


if __name__ == "__main__":
    main()
