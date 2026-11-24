/**
 * A Pull requests list row as the Linked pull requests sheet's glass card on the no3y iPhone
 * layout — see `.fork/customizations.yaml#no3y-pr-list-bottom-filters`: the number on the tinted
 * pull request pill, then the title, then the repository and what needs attention.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import { useGT, useMessages } from "gt-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { RelativeTime } from "../src/components/RelativeTime";
import { AppText as Text } from "../src/components/ui/AppText";
import { Menu } from "../src/components/ui/Menu";
import type { MenuProps } from "../src/components/ui/Menu.types";
import {
  ListRowLabel,
  pullRequestListRowAccessibilityLabel,
} from "../src/features/pull-requests/PullRequestListRow";
import {
  pullRequestListReviewStatus,
  pullRequestListRowsAreEqual,
  type EnvironmentPullRequestListEntry,
} from "../src/features/pull-requests/pullRequestList";
import { pullRequestConflict } from "../src/features/pull-requests/pullRequestStatus";
import { NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { NO3Y_PULL_REQUEST_GLYPHS } from "./No3yPullRequestMark";
import { no3yPullRequestTone } from "./no3yPullRequestTone";
import { ChecksFailingMark, ChecksRunningMark } from "./No3yStatusPill";

const STAT = { fontSize: 13, ...NO3Y_FONT.medium, fontVariant: ["tabular-nums" as const] };

export const No3yPullRequestListCard = memo(
  function No3yPullRequestListCard(props: {
    readonly item: EnvironmentPullRequestListEntry;
    readonly palette: FlatGlassPalette;
    readonly busy: boolean;
    readonly onSelect: (item: EnvironmentPullRequestListEntry) => void;
    readonly getActions: (item: EnvironmentPullRequestListEntry) => MenuProps["actions"];
    readonly onAction: (item: EnvironmentPullRequestListEntry, action: string) => void;
  }) {
    const gt = useGT();
    const messages = useMessages();
    const { item, palette } = props;
    const open = item.state === "open";
    const tone = no3yPullRequestTone({ state: item.state, isDraft: item.isDraft });
    const pill = palette.prPill[tone];
    const conflict = pullRequestConflict(item, messages);
    const review = open ? pullRequestListReviewStatus(item, messages) : null;
    const checks = open ? (item.checksState ?? null) : null;
    const meta: Array<{ readonly key: string; readonly text: string; readonly color: string }> = [
      {
        key: "repository",
        text: item.repository.split("/").at(-1) ?? item.repository,
        color: palette.metaInk,
      },
    ];
    if (item.author) meta.push({ key: "author", text: item.author.login, color: palette.metaInk });
    if (conflict) meta.push({ key: "conflict", text: conflict.label, color: palette.statusFailed });
    if (review)
      meta.push({
        key: "review",
        text: review.label,
        color:
          item.reviewDecision === "changes-requested"
            ? palette.statusFailed
            : item.reviewDecision === "approved"
              ? palette.prOpen
              : item.viewerReviewRequested
                ? palette.statusAttention
                : palette.metaInk,
      });
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Menu
          shouldOpenOnLongPress
          title={`#${item.number} · ${item.repository}`}
          actions={props.getActions(item)}
          onPressAction={({ nativeEvent }) => props.onAction(item, nativeEvent.event)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: props.busy }}
            accessibilityLabel={pullRequestListRowAccessibilityLabel(item, gt, messages)}
            accessibilityHint={gt("Double tap to open. Touch and hold for quick actions.")}
            onPress={() => props.onSelect(item)}
            disabled={props.busy}
            style={({ pressed }) => ({
              gap: 6,
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 11,
              borderRadius: 20,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.controlBorder,
              backgroundColor: pressed ? palette.rowSelected : palette.controlSurface,
              opacity: props.busy ? 0.5 : 1,
            })}
          >
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                rowGap: 4,
              }}
            >
              <View
                style={{
                  minHeight: 24,
                  paddingVertical: 2,
                  borderRadius: 12,
                  paddingLeft: 7,
                  paddingRight: 9,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: pill.tint ?? palette.circleFill,
                }}
              >
                <HugeIcon icon={NO3Y_PULL_REQUEST_GLYPHS[tone]} size={14} color={pill.ink} />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    fontVariant: ["tabular-nums"],
                    color: pill.ink,
                  }}
                >
                  #{item.number}
                </Text>
              </View>
              {item.stack ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <HugeIcon icon={Layers01Icon} filled size={12} color={palette.metaInk} />
                  <Text style={{ ...STAT, color: palette.metaInk }}>
                    {item.stack.position}/{item.stack.size}
                  </Text>
                </View>
              ) : null}
              {checks === "failing" ? <ChecksFailingMark color={palette.statusFailed} /> : null}
              {checks === "pending" ? <ChecksRunningMark color={palette.statusAttention} /> : null}
              <View style={{ flex: 1 }} />
              {item.additions > 0 ? (
                <Text style={{ ...STAT, color: palette.prOpen }}>
                  +{item.additions.toLocaleString()}
                </Text>
              ) : null}
              {item.deletions > 0 ? (
                <Text style={{ ...STAT, color: palette.statusFailed }}>
                  −{item.deletions.toLocaleString()}
                </Text>
              ) : null}
              <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
            </View>
            <Text
              numberOfLines={2}
              style={{ fontSize: 15, lineHeight: 20, ...NO3Y_FONT.medium, color: palette.titleInk }}
            >
              {item.title}
            </Text>
            <Text style={{ fontSize: 13, color: palette.metaInk }}>
              {meta.map((part, index) => (
                <Text key={part.key} style={{ color: part.color }}>
                  {index > 0 ? " · " : ""}
                  {part.text}
                </Text>
              ))}
              {" · "}
              <RelativeTime timestamp={item.updatedAt} />
            </Text>
            {item.labels.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                {item.labels.slice(0, 3).map((label) => (
                  <ListRowLabel
                    key={label.name}
                    label={label}
                    textClassName="text-foreground-muted"
                  />
                ))}
                {item.labels.length > 3 ? (
                  <Text style={{ fontSize: 11, color: palette.faintInk }}>
                    +{item.labels.length - 3}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        </Menu>
      </View>
    );
  },
  (previous, next) =>
    pullRequestListRowsAreEqual(previous.item, next.item) &&
    previous.palette === next.palette &&
    previous.busy === next.busy &&
    previous.onSelect === next.onSelect &&
    previous.onAction === next.onAction &&
    previous.getActions === next.getActions,
);
