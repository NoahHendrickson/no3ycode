/**
 * The per-row glyph in the layers rail. Figma's layers panel is scannable because the icon
 * says what KIND of thing a row is before you read its name; the tag is the only type
 * signal a DOM tree has, mapped through the same designer vocabulary the guest's labels use
 * (engine/vendor/layers.ts TAG_LABELS — a div is a Frame).
 */
import {
  CubeIcon,
  CursorTextIcon,
  Image01Icon,
  InputTextIcon,
  LeftToRightListBulletIcon,
  Link01Icon,
  NewsIcon,
  SquareIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";

import type { IconSvgElement } from "~/custom/icons/hugeiconsFill";

import { glyph } from "./PanelIcons";

const BY_TAG: Record<string, IconSvgElement> = {
  a: Link01Icon,
  article: NewsIcon,
  button: CursorTextIcon,
  h1: TextIcon,
  h2: TextIcon,
  h3: TextIcon,
  h4: TextIcon,
  h5: TextIcon,
  h6: TextIcon,
  img: Image01Icon,
  input: InputTextIcon,
  li: LeftToRightListBulletIcon,
  ol: LeftToRightListBulletIcon,
  p: TextIcon,
  picture: Image01Icon,
  select: InputTextIcon,
  span: TextIcon,
  svg: CubeIcon,
  textarea: InputTextIcon,
  ul: LeftToRightListBulletIcon,
  video: Image01Icon,
};

/** One wrapper per distinct glyph, built at load — `glyph()` pins the panel's weight, and
 * a render must pick a component type, never mint one. */
const WRAPPED = new Map<IconSvgElement, ReturnType<typeof glyph>>(
  [...new Set([...Object.values(BY_TAG), SquareIcon])].map((Base) => [Base, glyph(Base)]),
);
const FALLBACK_GLYPH = WRAPPED.get(SquareIcon)!;

export function LayerTypeIcon({ tag, className }: { tag: string; className?: string }) {
  const Base = BY_TAG[tag];
  const Glyph = (Base && WRAPPED.get(Base)) ?? FALLBACK_GLYPH;
  // oxlint-disable-next-line react/static-components -- Glyph is looked up from WRAPPED, built once at load, so a render never mints a component type.
  return <Glyph className={className} aria-hidden />;
}
