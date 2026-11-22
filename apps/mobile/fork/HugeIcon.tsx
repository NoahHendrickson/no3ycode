/**
 * Draws a Hugeicons glyph (`@hugeicons/core-free-icons` data, the set the Mac fork uses) with
 * react-native-svg — see `.fork/customizations.yaml#no3y-mobile-redesign`. Import glyphs by
 * subpath (`@hugeicons/core-free-icons/CodeIcon`) so Metro bundles only the ones drawn.
 */
import type { ComponentType } from "react";
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from "react-native-svg";

type Attributes = { readonly [name: string]: string | number };
/** One glyph as the package ships it: SVG element tags with web-style camelCase attributes. */
export type HugeIconData = ReadonlyArray<readonly [string, Attributes]>;

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

export function HugeIcon(props: {
  readonly icon: HugeIconData;
  readonly size: number;
  readonly color: string;
  readonly strokeWidth?: number;
}) {
  return (
    <Svg width={props.size} height={props.size} viewBox="0 0 24 24" fill="none">
      {props.icon.map(([tag, attrs]) => {
        const Element = ELEMENTS[tag];
        if (!Element) return null;
        const { key, ...rest } = attrs;
        const drawn: Record<string, string | number> = { fill: "none" };
        for (const [name, value] of Object.entries(rest)) {
          drawn[name] = value === "currentColor" ? props.color : value;
        }
        if (props.strokeWidth !== undefined && drawn["strokeWidth"] !== undefined) {
          drawn["strokeWidth"] = props.strokeWidth;
        }
        return <Element key={String(key)} {...drawn} />;
      })}
    </Svg>
  );
}
