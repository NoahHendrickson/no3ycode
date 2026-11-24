/**
 * Pull request checks marks on no3y iOS: the status pill, the linked pull request cards and the
 * Pull requests list cards —
 * see `.fork/customizations.yaml#no3y-linked-pr-row`.
 */
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

const MARK_SIZE = 16;

/** Figma's checks-running mark: a ring with a three-quarter pie. */
export function ChecksRunningMark(props: { readonly color: string }) {
  return (
    <View
      style={{
        width: MARK_SIZE,
        height: MARK_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
        <Path
          d="M11 7C11 7.79113 10.7654 8.56448 10.3259 9.22228C9.88635 9.88008 9.26164 10.3928 8.53073 10.6955C7.79983 10.9983 6.99556 11.0775 6.21964 10.9231C5.44371 10.7688 4.73098 10.3878 4.17157 9.82843C3.61216 9.26902 3.2312 8.55629 3.07686 7.78036C2.92252 7.00444 3.00173 6.20017 3.30448 5.46927C3.60723 4.73836 4.11992 4.11365 4.77772 3.67412C5.43552 3.2346 6.20887 3 7 3V7H11Z"
          fill={props.color}
        />
        <Circle cx={7} cy={7} r={6.5} stroke={props.color} />
      </Svg>
    </View>
  );
}

/** The checks-failing mark: a solid dot the size of the running mark's inner pie. */
export function ChecksFailingMark(props: { readonly color: string }) {
  return (
    <View
      style={{
        width: MARK_SIZE,
        height: MARK_SIZE,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={4} fill={props.color} />
      </Svg>
    </View>
  );
}
