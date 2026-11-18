/**
 * The design panel's field glyphs, named for what they MEAN in the panel rather than for
 * the shape they happen to use — so a swap of glyph is a one-line change here and the panel
 * keeps reading as design vocabulary ("GapIcon", not "FoldHorizontal").
 *
 * Always stroked, never the fork palettes' filled weight: a filled counter reads as mud at
 * the 16px a dense properties panel uses (t3-fork file, page V2, node 193:9686).
 */
import * as Hg from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";

import type { IconSvgElement } from "~/custom/icons/hugeiconsFill";
import { HugeGlyph } from "~/custom/icons/lucide-hugeicons";

type GlyphProps = Omit<ComponentProps<typeof HugeGlyph>, "data" | "filled">;

/** Pins the panel's stroke while leaving size to the caller's `size-*` class. */
function glyph(data: IconSvgElement) {
  const Wrapped = (props: GlyphProps) => <HugeGlyph {...props} data={data} filled={false} />;
  Wrapped.displayName = "PanelGlyph";
  return Wrapped;
}

// Position — the align row and the absolute toggle.
export const AlignHStartIcon = glyph(Hg.AlignLeftIcon);
export const AlignHCenterIcon = glyph(Hg.AlignHorizontalCenterIcon);
export const AlignHEndIcon = glyph(Hg.AlignRightIcon);
export const AlignVStartIcon = glyph(Hg.AlignTopIcon);
export const AlignVCenterIcon = glyph(Hg.AlignVerticalCenterIcon);
export const AlignVEndIcon = glyph(Hg.AlignBottomIcon);
export const AbsolutePositionIcon = glyph(Hg.PinIcon);

export const AutoLayoutIcon = glyph(Hg.GridViewIcon);
export const DirectionRowIcon = glyph(Hg.ArrowRight02Icon);
export const DirectionColumnIcon = glyph(Hg.ArrowDown02Icon);
export const GapRowIcon = glyph(Hg.FoldHorizontalIcon);
export const GapColumnIcon = glyph(Hg.FoldVerticalIcon);
export const AspectLockedIcon = glyph(Hg.Link02Icon);
export const AspectUnlockedIcon = glyph(Hg.Unlink05Icon);
export const WrapIcon = glyph(Hg.CornerDownRightIcon);
export const GrowIcon = glyph(Hg.ArrowExpandIcon);
export const ShrinkIcon = glyph(Hg.ArrowShrinkIcon);

// Appearance.
export const OpacityIcon = glyph(Hg.ContrastIcon);
export const RadiusIcon = glyph(Hg.SquareRoundCornerIcon);
export const PerCornerIcon = glyph(Hg.FullScreenIcon);

// Typography.
export const FontSizeIcon = glyph(Hg.TextFontIcon);
export const FontWeightIcon = glyph(Hg.TextBoldIcon);
export const LineHeightIcon = glyph(Hg.UnfoldVerticalIcon);
export const LetterSpacingIcon = glyph(Hg.LetterSpacingIcon);
export const TextColorIcon = glyph(Hg.TextIcon);
export const TextAlignLeftIcon = glyph(Hg.TextAlignLeftIcon);
export const TextAlignCenterIcon = glyph(Hg.TextAlignCenterIcon);
export const TextAlignRightIcon = glyph(Hg.TextAlignRightIcon);
export const TextAlignJustifyIcon = glyph(Hg.TextAlignJustifyCenterIcon);

// Canvas strip. Pinned like the rest of the panel: the strip sits inside it, and mixing
// weights there reads as two different toolbars (PR #57 review).
export const CanvasIcon = glyph(Hg.SquareDashedIcon);
export const ScreenSizeIcon = glyph(Hg.ComputerIcon);
export const ZoomOutIcon = glyph(Hg.MinusSignIcon);
export const ZoomInIcon = glyph(Hg.PlusSignIcon);
export const ZoomFitIcon = glyph(Hg.ArrowExpandIcon);

// Fill and stroke.
export const FillIcon = glyph(Hg.PaintBucketIcon);
export const StrokeWidthIcon = glyph(Hg.StrokeCenterIcon);
export const StrokeStyleIcon = glyph(Hg.DashedLine01Icon);
export const StrokeColorIcon = glyph(Hg.PaintBrush01Icon);
