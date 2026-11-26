/**
 * The design panel's field glyphs, named for what they MEAN in the panel rather than for
 * the shape they happen to use — so a swap of glyph is a one-line change here and the panel
 * keeps reading as design vocabulary ("GapIcon", not "FoldHorizontal").
 *
 * Always stroked, never the fork palettes' filled weight: a filled counter reads as mud at
 * the 16px a dense properties panel uses (t3-fork file, page V2, node 193:9686).
 */
import type { ComponentProps } from "react";

import {
  ArrowDownIcon,
  ArrowRightIcon,
  FoldHorizontalIcon,
  FoldVerticalIcon,
  Link2,
  type LucideIcon,
  MaximizeIcon,
  StrokeGlyphs as G,
  TextIcon,
  UnfoldVerticalIcon,
} from "~/custom/icons/lucide-hugeicons";

type GlyphProps = Omit<ComponentProps<LucideIcon>, "weight">;

/** Pins the panel's stroke while leaving size to the caller's `size-*` class. */
function glyph(Icon: LucideIcon) {
  const Wrapped = (props: GlyphProps) => <Icon {...props} weight="stroke" />;
  Wrapped.displayName = "PanelGlyph";
  return Wrapped;
}

// Position — the align row and the absolute toggle.
export const AlignHStartIcon = glyph(G.AlignLeft);
export const AlignHCenterIcon = glyph(G.AlignHorizontalCenter);
export const AlignHEndIcon = glyph(G.AlignRight);
export const AlignVStartIcon = glyph(G.AlignTop);
export const AlignVCenterIcon = glyph(G.AlignVerticalCenter);
export const AlignVEndIcon = glyph(G.AlignBottom);
export const AbsolutePositionIcon = glyph(G.Pushpin);

export const AutoLayoutIcon = glyph(G.GridView);
export const DirectionRowIcon = glyph(ArrowRightIcon);
export const DirectionColumnIcon = glyph(ArrowDownIcon);
export const GapRowIcon = glyph(FoldHorizontalIcon);
export const GapColumnIcon = glyph(FoldVerticalIcon);
export const AspectLockedIcon = glyph(Link2);
export const AspectUnlockedIcon = glyph(G.Unlink05);
export const WrapIcon = glyph(G.CornerDownRight);
export const GrowIcon = glyph(G.ArrowExpand);
export const ShrinkIcon = glyph(G.ArrowShrink);

// Appearance.
export const OpacityIcon = glyph(G.Contrast);
export const RadiusIcon = glyph(G.SquareRoundCorner);
export const PerCornerIcon = glyph(MaximizeIcon);

// Typography.
export const FontSizeIcon = glyph(G.TextFont);
export const FontWeightIcon = glyph(G.TextBold);
export const LineHeightIcon = glyph(UnfoldVerticalIcon);
export const LetterSpacingIcon = glyph(G.LetterSpacing);
export const TextColorIcon = glyph(TextIcon);
export const TextAlignLeftIcon = glyph(G.TextAlignLeft);
export const TextAlignCenterIcon = glyph(G.TextAlignCenter);
export const TextAlignRightIcon = glyph(G.TextAlignRight);
export const TextAlignJustifyIcon = glyph(G.TextAlignJustifyCenter);

// Canvas strip. Pinned like the rest of the panel: the strip sits inside it, and mixing
// weights there reads as two different toolbars (PR #57 review).
export const CanvasIcon = glyph(G.SquareDashed);
export const ScreenSizeIcon = glyph(G.Computer);
export const ZoomOutIcon = glyph(G.MinusSign);
export const ZoomInIcon = glyph(G.PlusSign);
export const ZoomFitIcon = glyph(G.ArrowExpand);

// Fill and stroke.
export const FillIcon = glyph(G.PaintBucket);
export const StrokeWidthIcon = glyph(G.StrokeCenter);
export const StrokeStyleIcon = glyph(G.DashedLine01);
export const StrokeColorIcon = glyph(G.PaintBrush01);
