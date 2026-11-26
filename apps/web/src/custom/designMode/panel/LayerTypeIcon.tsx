/**
 * The per-row glyph in the layers rail. Figma's layers panel is scannable because the icon
 * says what KIND of thing a row is before you read its name; the tag is the only type
 * signal a DOM tree has, mapped through the same designer vocabulary the guest's labels use
 * (engine/vendor/layers.ts TAG_LABELS — a div is a Frame).
 */
import {
  ImageIcon,
  type LucideIcon,
  Square,
  StrokeGlyphs as G,
  TextIcon,
} from "~/custom/icons/lucide-hugeicons";

const BY_TAG: Record<string, LucideIcon> = {
  a: G.Link01,
  article: G.News,
  button: G.CursorText,
  h1: TextIcon,
  h2: TextIcon,
  h3: TextIcon,
  h4: TextIcon,
  h5: TextIcon,
  h6: TextIcon,
  img: ImageIcon,
  input: G.InputText,
  li: G.LeftToRightListBullet,
  ol: G.LeftToRightListBullet,
  p: TextIcon,
  picture: ImageIcon,
  select: G.InputText,
  span: TextIcon,
  svg: G.Cube,
  textarea: G.InputText,
  ul: G.LeftToRightListBullet,
  video: ImageIcon,
};

export function LayerTypeIcon({ tag, className }: { tag: string; className?: string }) {
  const Icon = BY_TAG[tag] ?? Square;
  return <Icon weight="stroke" className={className} aria-hidden />;
}
