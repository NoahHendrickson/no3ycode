/**
 * The design panel's field glyphs, named for what they MEAN in the panel rather than for
 * the shape they happen to use — so a swap of glyph is a one-line change here and the panel
 * keeps reading as design vocabulary ("GapIcon", not "FoldHorizontal").
 *
 * Always stroked, never the fork palettes' filled weight: a filled counter reads as mud at
 * the 16px a dense properties panel uses (t3-fork file, page V2, node 193:9686).
 */
import { StrokeGlyphs as G } from "~/custom/icons/lucide-hugeicons";

// Position — the align row and the absolute toggle.
export const AlignHStartIcon = G.AlignLeft;
export const AlignHCenterIcon = G.AlignHorizontalCenter;
export const AlignHEndIcon = G.AlignRight;
export const AlignVStartIcon = G.AlignTop;
export const AlignVCenterIcon = G.AlignVerticalCenter;
export const AlignVEndIcon = G.AlignBottom;
export const AbsolutePositionIcon = G.Pushpin;

export const AutoLayoutIcon = G.GridView;
export const DirectionRowIcon = G.ArrowRight02;
export const DirectionColumnIcon = G.ArrowDown02;
export const GapRowIcon = G.FoldHorizontal;
export const GapColumnIcon = G.FoldVertical;
export const AspectLockedIcon = G.Link02;
export const AspectUnlockedIcon = G.Unlink05;
export const WrapIcon = G.CornerDownRight;
export const GrowIcon = G.ArrowExpand;
export const ShrinkIcon = G.ArrowShrink;

// Appearance.
export const OpacityIcon = G.Contrast;
export const RadiusIcon = G.SquareRoundCorner;
export const PerCornerIcon = G.FullScreen;

// Typography.
export const FontSizeIcon = G.TextFont;
export const FontWeightIcon = G.TextBold;
export const LineHeightIcon = G.UnfoldVertical;
export const LetterSpacingIcon = G.LetterSpacing;
export const TextColorIcon = G.Text;
export const TextAlignLeftIcon = G.TextAlignLeft;
export const TextAlignCenterIcon = G.TextAlignCenter;
export const TextAlignRightIcon = G.TextAlignRight;
export const TextAlignJustifyIcon = G.TextAlignJustifyCenter;

// Canvas strip. Pinned like the rest of the panel: the strip sits inside it, and mixing
// weights there reads as two different toolbars (PR #57 review).
export const CanvasIcon = G.SquareDashed;
export const ScreenSizeIcon = G.Computer;
export const ZoomOutIcon = G.MinusSign;
export const ZoomInIcon = G.PlusSign;
export const ZoomFitIcon = G.ArrowExpand;

// Fill and stroke.
export const FillIcon = G.PaintBucket;
export const StrokeWidthIcon = G.StrokeCenter;
export const StrokeStyleIcon = G.DashedLine01;
export const StrokeColorIcon = G.PaintBrush01;
