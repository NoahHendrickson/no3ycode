import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  FileIcon,
  FilesIcon,
  FolderIcon,
  GlobeIcon,
  Grid2x2Icon,
  Notification01Icon,
  PenLineIcon,
  ServerIcon,
  SunIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vite-plus/test";

import { canFill, GLYPH_STROKE, glyphDrawing, type IconSvgElement } from "./hugeiconsFill";

const counts = (icon: IconSvgElement) => {
  const { bodies, knockouts, holes, plain } = glyphDrawing(icon, true);
  const rims = holes.filter(([, attrs]) => attrs["stroke"] === "white").length;
  return {
    bodies: bodies.length,
    knockouts: knockouts.length,
    holes: holes.length - rims,
    rims,
    plain: plain.length,
  };
};

describe("glyphDrawing", () => {
  it("fills the enclosing shape, unstroked, and cuts the detail inside it out within a rim", () => {
    expect(counts(CheckmarkCircle02Icon)).toEqual({
      bodies: 1,
      knockouts: 0,
      holes: 1,
      rims: 1,
      plain: 0,
    });
    expect(glyphDrawing(CheckmarkCircle02Icon, true).bodies[0]?.[1]).toMatchObject({
      fill: "currentColor",
      stroke: "none",
    });
  });

  it("fills a closed contour that shares its path with an open one", () => {
    // The page closes; the fold in the same path does not, and spans it end to end, so it
    // cuts the dog-ear off through the edge.
    expect(counts(FileIcon)).toMatchObject({ bodies: 1, knockouts: 1, plain: 0, rims: 1 });
    expect(counts(FileIcon).holes).toBeGreaterThan(0);
  });

  it("cuts through the edge only where a detail runs to it", () => {
    // The grid's lines meet its frame, so they divide the body rather than sit inside it.
    expect(counts(Grid2x2Icon)).toMatchObject({ bodies: 1, holes: 0, rims: 0 });
    expect(counts(Grid2x2Icon).knockouts).toBeGreaterThan(0);
    // The page fold stops short of the page's corner but spans it end to end, so it parts the
    // dog-ear off rather than leaving a rim sliver along the corner.
    expect(counts(FilesIcon)).toMatchObject({ bodies: 1, knockouts: 1 });
  });

  it("parts bodies whose outlines meet with a seam", () => {
    expect(counts(ServerIcon)).toMatchObject({ bodies: 2, knockouts: 1 });
  });

  it("keeps a closed part too small to fill as a stroke", () => {
    // The sun's rays end in dots; filled, a dot is erased by its own ray.
    const { bodies, plain } = counts(SunIcon);
    expect(bodies).toBe(1);
    expect(plain).toBeGreaterThan(8);
  });

  it("keeps a part outside the body stroked, even inside the body's bounds", () => {
    // The bell's clapper hangs below its body; the pen's baseline runs beside it.
    expect(counts(Notification01Icon)).toMatchObject({
      bodies: 1,
      knockouts: 0,
      holes: 0,
      plain: 1,
    });
    expect(counts(PenLineIcon)).toMatchObject({ bodies: 1, knockouts: 0, holes: 0, plain: 1 });
  });

  it("measures a part where its transform puts it", () => {
    // The globe's disc is placed by a matrix; its continents lie inside it once applied.
    expect(counts(GlobeIcon).knockouts).toBe(2);
  });

  it("leaves a glyph with nothing closed, or only a minor closed part, as a stroke", () => {
    expect(canFill(ArrowRight02Icon)).toBe(false);
    // Only the clip closes; filling it alone reads as a different icon.
    expect(canFill(ClipboardListIcon)).toBe(false);
    expect(glyphDrawing(ArrowRight02Icon, true)).toBe(glyphDrawing(ArrowRight02Icon, false));
  });

  it("draws no knockouts when nothing sits inside the body", () => {
    expect(counts(FolderIcon)).toMatchObject({ bodies: 1, knockouts: 0, holes: 0, plain: 0 });
  });

  it("stops on malformed path data instead of looping", () => {
    expect(canFill([["path", { d: "M0 0L20 0L20 20Z 3 3", stroke: "currentColor" }]])).toBe(true);
  });

  it("leaves the shared stroke to the <svg>, so a caller's stroke props reach every part", () => {
    for (const [, attrs] of glyphDrawing(ZapIcon, false).plain) {
      for (const name of Object.keys(GLYPH_STROKE)) expect(attrs).not.toHaveProperty(name);
    }
  });
});
