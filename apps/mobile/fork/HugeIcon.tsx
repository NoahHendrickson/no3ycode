/**
 * Draws a Hugeicons glyph (`@hugeicons/core-free-icons` data, the set the Mac fork uses) with
 * react-native-svg — see `.fork/customizations.yaml#no3y-mobile-redesign`. Import glyphs by
 * subpath (`@hugeicons/core-free-icons/CodeIcon`) so Metro bundles only the ones drawn. `filled`
 * draws the weight the Mac derives in hugeiconsFill.ts (a copy lives beside this file).
 */
import { useId, type ComponentType } from "react";
import type { ColorValue } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Mask,
  Path,
  Polygon,
  Polyline,
  Rect,
} from "react-native-svg";

import { GLYPH_STROKE, glyphDrawing, type IconSvgElement } from "./hugeiconsFill";

type Attributes = { readonly [name: string]: string | number };
/** One glyph as the package ships it: SVG element tags with web-style camelCase attributes. */
export type HugeIconData = IconSvgElement;

// Glyph attributes are the SVG attributes react-native-svg takes, but only as loose strings.
const ELEMENTS = {
  path: Path,
  circle: Circle,
  ellipse: Ellipse,
  line: Line,
  rect: Rect,
  polygon: Polygon,
  polyline: Polyline,
} as unknown as Readonly<Record<string, ComponentType<Attributes>>>;

function drawElements(elements: IconSvgElement, color: ColorValue) {
  return elements.map(([tag, attrs], index) => {
    const Element = ELEMENTS[tag];
    if (!Element) return null;
    const { key, ...rest } = attrs;
    const drawn: Record<string, ColorValue | number> = {};
    for (const [name, value] of Object.entries(rest)) {
      drawn[name] = value === "currentColor" ? color : value;
    }
    if (drawn["fill"] === undefined) drawn["fill"] = "none";
    return <Element key={String(key ?? index)} {...drawn} />;
  });
}

export function HugeIcon(props: {
  readonly icon: HugeIconData;
  readonly size: number;
  readonly color: ColorValue;
  readonly strokeWidth?: number;
  readonly filled?: boolean;
}) {
  const maskId = `no3y-icon-${useId().replace(/[^\w-]/g, "")}`;
  const drawing = glyphDrawing(props.icon, props.filled === true);
  const masked = drawing.knockouts.length > 0;
  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 24 24" fill="none">
      {masked ? (
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
            <Rect x={0} y={0} width={24} height={24} fill="white" />
            <G stroke="black" strokeLinecap="round" strokeLinejoin="round">
              {drawElements(drawing.knockouts, "black")}
            </G>
          </Mask>
        </Defs>
      ) : null}
      <G
        stroke={props.color}
        strokeWidth={props.strokeWidth ?? Number(GLYPH_STROKE.strokeWidth)}
        strokeLinecap={GLYPH_STROKE.strokeLinecap}
        strokeLinejoin={GLYPH_STROKE.strokeLinejoin}
      >
        {drawing.bodies.length > 0 ? (
          <G mask={masked ? `url(#${maskId})` : undefined}>
            {drawElements(drawing.bodies, props.color)}
          </G>
        ) : null}
        {drawElements(drawing.plain, props.color)}
      </G>
    </Svg>
  );
}
