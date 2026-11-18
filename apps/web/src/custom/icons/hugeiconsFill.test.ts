import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  Notification01Icon,
  PenLineIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vite-plus/test";

import { canFill, GLYPH_STROKE, glyphDrawing, type IconSvgElement } from "./hugeiconsFill";

const counts = (icon: IconSvgElement) => {
  const { bodies, knockouts, plain } = glyphDrawing(icon, true);
  return { bodies: bodies.length, knockouts: knockouts.length, plain: plain.length };
};

describe("glyphDrawing", () => {
  it("fills the enclosing shape and cuts the detail inside it out", () => {
    expect(counts(CheckmarkCircle02Icon)).toEqual({ bodies: 1, knockouts: 1, plain: 0 });
  });

  it("fills a closed contour that shares its path with an open one", () => {
    // The page closes; the fold corner in the same path does not, and is cut out of the page.
    expect(counts(FileIcon)).toMatchObject({ bodies: 1, plain: 0 });
    expect(counts(FileIcon).knockouts).toBeGreaterThan(0);
  });

  it("keeps a part outside the body stroked, even inside the body's bounds", () => {
    // The bell's clapper hangs below its body; the pen's baseline runs beside it.
    expect(counts(Notification01Icon)).toEqual({ bodies: 1, knockouts: 0, plain: 1 });
    expect(counts(PenLineIcon)).toEqual({ bodies: 1, knockouts: 0, plain: 1 });
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
    expect(counts(FolderIcon)).toEqual({ bodies: 1, knockouts: 0, plain: 0 });
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
