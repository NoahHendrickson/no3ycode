/**
 * The per-row glyph in the layers rail. Figma's layers panel is scannable because the icon
 * says what KIND of thing a row is before you read its name; the tag is the only type
 * signal a DOM tree has, mapped through the same designer vocabulary the guest's labels use
 * (engine/vendor/layers.ts TAG_LABELS — a div is a Frame).
 */
import { type StrokeGlyph, StrokeGlyphs as G } from "~/custom/icons/lucide-hugeicons";

const BY_TAG: Record<string, StrokeGlyph> = {
  a: G.Link01,
  article: G.News,
  button: G.CursorText,
  h1: G.Text,
  h2: G.Text,
  h3: G.Text,
  h4: G.Text,
  h5: G.Text,
  h6: G.Text,
  img: G.Image,
  input: G.InputText,
  li: G.LeftToRightListBullet,
  ol: G.LeftToRightListBullet,
  p: G.Text,
  picture: G.Image,
  select: G.InputText,
  span: G.Text,
  svg: G.Cube,
  textarea: G.InputText,
  ul: G.LeftToRightListBullet,
  video: G.Image,
};

export function LayerTypeIcon({ tag, className }: { tag: string; className?: string }) {
  const Icon = BY_TAG[tag] ?? G.Square;
  return <Icon className={className} aria-hidden />;
}
