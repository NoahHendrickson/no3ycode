import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function T3Wordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  /* fork:begin fork-brand-name — see .fork/customizations.yaml#fork-brand-name */
  // The no3y flower as line art in place of upstream's "T3" letters: the outline cells of
  // assets/fork/n3-favicon.svg merged into row runs, so touching cells leave no seams.
  return (
    <Svg
      accessibilityLabel="no3y"
      height={props.height}
      width={props.height}
      viewBox="-0.5 -0.5 16 16"
    >
      <ThemedPath
        d="M6 0h3v1h-3zM5 1h1v1h-1zM7 1h1v1h-1zM9 1h1v1h-1zM4 2h1v1h-1zM7 2h1v1h-1zM10 2h1v1h-1zM4 3h2v1h-2zM7 3h1v1h-1zM9 3h2v1h-2zM2 4h7v1h-7zM10 4h3v1h-3zM1 5h1v1h-1zM4 5h1v1h-1zM7 5h1v1h-1zM10 5h2v1h-2zM13 5h1v1h-1zM0 6h1v1h-1zM5 6h1v1h-1zM8 6h1v1h-1zM10 6h1v1h-1zM14 6h1v1h-1zM0 7h15v1h-15zM0 8h1v1h-1zM5 8h1v1h-1zM8 8h1v1h-1zM10 8h1v1h-1zM14 8h1v1h-1zM1 9h1v1h-1zM4 9h1v1h-1zM7 9h1v1h-1zM11 9h1v1h-1zM13 9h1v1h-1zM2 10h11v1h-11zM4 11h2v1h-2zM7 11h1v1h-1zM9 11h2v1h-2zM4 12h1v1h-1zM7 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM9 13h1v1h-1zM6 14h3v1h-3z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
  /* fork:end fork-brand-name */
}
