import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  ClipboardListIcon,
  Notification01Icon,
} from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vite-plus/test";

import { deriveFilledIcon, type IconSvgElement } from "./hugeiconsFill";

const tags = (elements: IconSvgElement) => elements.map(([tag]) => tag);

describe("deriveFilledIcon", () => {
  it("fills the enclosing shape and cuts the detail inside it out", () => {
    const filled = deriveFilledIcon(CheckmarkCircle02Icon);
    expect(filled?.bodies).toHaveLength(1);
    expect(filled?.knockouts.length).toBeGreaterThan(0);
    expect(filled?.loose).toEqual([]);
  });

  it("keeps a part drawn outside the body stroked", () => {
    // The bell's clapper hangs below its body.
    const filled = deriveFilledIcon(Notification01Icon);
    expect(filled?.bodies).toHaveLength(1);
    expect(tags(filled?.loose ?? [])).toEqual(["path"]);
  });

  it("leaves a glyph with nothing closed to fill as a stroke", () => {
    expect(deriveFilledIcon(ArrowRight02Icon)).toBeNull();
  });

  it("does not fill a closed part that is only a minor piece of the glyph", () => {
    // Only the clip closes; filling it alone reads as a different icon.
    expect(deriveFilledIcon(ClipboardListIcon)).toBeNull();
  });
});
