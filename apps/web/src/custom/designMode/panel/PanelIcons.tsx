/**
 * The design panel's field glyphs, named for what they MEAN in the panel rather than for
 * the shape they happen to use — so a swap of glyph is a one-line change here and the panel
 * keeps reading as design vocabulary ("GapIcon", not "FoldHorizontal").
 *
 * Always stroked, never the fork palettes' filled weight: a filled counter reads as mud at
 * the 16px a dense properties panel uses (t3-fork file, page V2, node 193:9686).
 */
import {
  AlignBottomIcon as HgAlignBottom,
  AlignHorizontalCenterIcon as HgAlignHorizontalCenter,
  AlignLeftIcon as HgAlignLeft,
  AlignRightIcon as HgAlignRight,
  AlignTopIcon as HgAlignTop,
  AlignVerticalCenterIcon as HgAlignVerticalCenter,
  ArrowDown02Icon as HgArrowDown02,
  ArrowExpandIcon as HgArrowExpand,
  ArrowRight02Icon as HgArrowRight02,
  ArrowShrinkIcon as HgArrowShrink,
  ComputerIcon as HgComputer,
  ContrastIcon as HgContrast,
  CornerDownRightIcon as HgCornerDownRight,
  DashedLine01Icon as HgDashedLine01,
  FoldHorizontalIcon as HgFoldHorizontal,
  FoldVerticalIcon as HgFoldVertical,
  FullScreenIcon as HgFullScreen,
  GridViewIcon as HgGridView,
  LetterSpacingIcon as HgLetterSpacing,
  Link02Icon as HgLink02,
  MinusSignIcon as HgMinusSign,
  PaintBrush01Icon as HgPaintBrush01,
  PaintBucketIcon as HgPaintBucket,
  PinIcon as HgPin,
  PlusSignIcon as HgPlusSign,
  SquareDashedIcon as HgSquareDashed,
  SquareRoundCornerIcon as HgSquareRoundCorner,
  StrokeCenterIcon as HgStrokeCenter,
  TextAlignCenterIcon as HgTextAlignCenter,
  TextAlignJustifyCenterIcon as HgTextAlignJustifyCenter,
  TextAlignLeftIcon as HgTextAlignLeft,
  TextAlignRightIcon as HgTextAlignRight,
  TextBoldIcon as HgTextBold,
  TextFontIcon as HgTextFont,
  TextIcon as HgText,
  UnfoldVerticalIcon as HgUnfoldVertical,
  Unlink05Icon as HgUnlink05,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";

import type { IconSvgElement } from "~/custom/icons/hugeiconsFill";
import { HugeGlyph } from "~/custom/icons/lucide-hugeicons";

type GlyphProps = Omit<ComponentProps<typeof HugeGlyph>, "data" | "filled">;

/** Pins the panel's stroke while leaving size to the caller's `size-*` class. Exported so
 * every fork surface that draws design-mode chrome (the layers rail's type glyphs, the
 * canvas strip) draws the same weight instead of re-deriving it. */
export function glyph(data: IconSvgElement) {
  const Wrapped = (props: GlyphProps) => <HugeGlyph {...props} data={data} filled={false} />;
  Wrapped.displayName = "PanelGlyph";
  return Wrapped;
}

// Position — the align row and the absolute toggle.
export const AlignHStartIcon = glyph(HgAlignLeft);
export const AlignHCenterIcon = glyph(HgAlignHorizontalCenter);
export const AlignHEndIcon = glyph(HgAlignRight);
export const AlignVStartIcon = glyph(HgAlignTop);
export const AlignVCenterIcon = glyph(HgAlignVerticalCenter);
export const AlignVEndIcon = glyph(HgAlignBottom);
export const AbsolutePositionIcon = glyph(HgPin);

export const AutoLayoutIcon = glyph(HgGridView);
export const DirectionRowIcon = glyph(HgArrowRight02);
export const DirectionColumnIcon = glyph(HgArrowDown02);
export const GapRowIcon = glyph(HgFoldHorizontal);
export const GapColumnIcon = glyph(HgFoldVertical);
export const AspectLockedIcon = glyph(HgLink02);
export const AspectUnlockedIcon = glyph(HgUnlink05);
export const WrapIcon = glyph(HgCornerDownRight);
export const GrowIcon = glyph(HgArrowExpand);
export const ShrinkIcon = glyph(HgArrowShrink);

// Appearance.
export const OpacityIcon = glyph(HgContrast);
export const RadiusIcon = glyph(HgSquareRoundCorner);
export const PerCornerIcon = glyph(HgFullScreen);

// Typography.
export const FontSizeIcon = glyph(HgTextFont);
export const FontWeightIcon = glyph(HgTextBold);
export const LineHeightIcon = glyph(HgUnfoldVertical);
export const LetterSpacingIcon = glyph(HgLetterSpacing);
export const TextColorIcon = glyph(HgText);
export const TextAlignLeftIcon = glyph(HgTextAlignLeft);
export const TextAlignCenterIcon = glyph(HgTextAlignCenter);
export const TextAlignRightIcon = glyph(HgTextAlignRight);
export const TextAlignJustifyIcon = glyph(HgTextAlignJustifyCenter);

// Canvas strip. Pinned like the rest of the panel: the strip sits inside it, and mixing
// weights there reads as two different toolbars (PR #57 review).
export const CanvasIcon = glyph(HgSquareDashed);
export const ScreenSizeIcon = glyph(HgComputer);
export const ZoomOutIcon = glyph(HgMinusSign);
export const ZoomInIcon = glyph(HgPlusSign);
export const ZoomFitIcon = glyph(HgArrowExpand);

// Fill and stroke.
export const FillIcon = glyph(HgPaintBucket);
export const StrokeWidthIcon = glyph(HgStrokeCenter);
export const StrokeStyleIcon = glyph(HgDashedLine01);
export const StrokeColorIcon = glyph(HgPaintBrush01);
