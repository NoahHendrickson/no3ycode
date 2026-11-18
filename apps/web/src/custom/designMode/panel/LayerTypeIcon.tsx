/**
 * The per-row glyph in the layers rail. Figma's layers panel is scannable because the icon
 * says what KIND of thing a row is before you read its name; the tag is the only type
 * signal a DOM tree has, mapped through the same designer vocabulary the guest's labels use
 * (engine/vendor/layers.ts TAG_LABELS — a div is a Frame).
 */
import * as Hg from "@hugeicons/core-free-icons";

import type { IconSvgElement } from "~/custom/icons/hugeiconsFill";
import { HugeGlyph } from "~/custom/icons/lucide-hugeicons";

const BY_TAG: Record<string, IconSvgElement> = {
  a: Hg.Link01Icon,
  article: Hg.NewsIcon,
  button: Hg.CursorTextIcon,
  h1: Hg.TextIcon,
  h2: Hg.TextIcon,
  h3: Hg.TextIcon,
  h4: Hg.TextIcon,
  h5: Hg.TextIcon,
  h6: Hg.TextIcon,
  img: Hg.Image01Icon,
  input: Hg.InputTextIcon,
  li: Hg.LeftToRightListBulletIcon,
  ol: Hg.LeftToRightListBulletIcon,
  p: Hg.TextIcon,
  picture: Hg.Image01Icon,
  select: Hg.InputTextIcon,
  span: Hg.TextIcon,
  svg: Hg.CubeIcon,
  textarea: Hg.InputTextIcon,
  ul: Hg.LeftToRightListBulletIcon,
  video: Hg.Image01Icon,
};

export function LayerTypeIcon({ tag, className }: { tag: string; className?: string }) {
  return (
    <HugeGlyph
      data={BY_TAG[tag] ?? Hg.SquareIcon}
      filled={false}
      className={className}
      aria-hidden
    />
  );
}
