/**
 * A pull request's state glyph and number in its state's colour, on no3y iOS thread cards and
 * runs — see `.fork/customizations.yaml#no3y-mobile-redesign` and fork/no3yPullRequestTone.ts.
 */
import GitMergeIcon from "@hugeicons/core-free-icons/GitMergeIcon";
import GitPullRequestClosedIcon from "@hugeicons/core-free-icons/GitPullRequestClosedIcon";
import GitPullRequestDraftIcon from "@hugeicons/core-free-icons/GitPullRequestDraftIcon";
import GitPullRequestIcon from "@hugeicons/core-free-icons/GitPullRequestIcon";
import { View, type TextStyle } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import type { FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import {
  no3yPullRequestColor,
  no3yPullRequestTone,
  type No3yPullRequestTone,
} from "./no3yPullRequestTone";

export const NO3Y_PULL_REQUEST_GLYPHS: Record<No3yPullRequestTone, HugeIconData> = {
  open: GitPullRequestIcon,
  merged: GitMergeIcon,
  closed: GitPullRequestClosedIcon,
  draft: GitPullRequestDraftIcon,
};

export function No3yPullRequestMark(props: {
  readonly pr: {
    readonly state: "open" | "closed" | "merged" | null;
    readonly isDraft: boolean;
    readonly label: string;
  };
  readonly palette: FlatGlassPalette;
  readonly gap: number;
  readonly textStyle: TextStyle;
}) {
  const tone = no3yPullRequestTone(props.pr);
  const color = no3yPullRequestColor(tone, props.palette);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: props.gap }}>
      <HugeIcon icon={NO3Y_PULL_REQUEST_GLYPHS[tone]} size={12} color={color} strokeWidth={1.5} />
      <Text style={{ ...props.textStyle, color }}>{props.pr.label}</Text>
    </View>
  );
}
