/**
 * The Linked pull requests sheet as the Agents sheet's glass cards
 * (`.fork/customizations.yaml#no3y-linked-pr-row`): one card per stack, each layer led by its
 * number on the status pill's tinted pull request pill, then its title and repository. State,
 * speech, opening and the long-press menu come from the upstream row's shared model.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import type { PullRequestListLine } from "@t3tools/client-runtime/thread-pull-requests";
import type { PullRequestChecksState, PullRequestReviewDecision } from "@t3tools/contracts";
import { useGT } from "gt-react-native";
import type { ReactElement } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelativeTime } from "../src/components/RelativeTime";
import { AppText as Text } from "../src/components/ui/AppText";
import { changeRequestTermKind } from "../src/lib/changeRequestTerm";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  LinkedPullRequestMenu,
  linkedPullRequestKey,
  useLinkedPullRequestModel,
} from "../src/features/threads/LinkedPullRequestList";
import type { LinkedPullRequestActions } from "../src/features/threads/useLinkedPullRequestActions";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { useNo3yBottomNavEnabled } from "./no3yBottomNavEnabled";
import { ChecksFailingMark, ChecksRunningMark } from "./No3yChecksMarks";
import { NO3Y_PULL_REQUEST_GLYPHS } from "./No3yPullRequestMark";
import { no3yPullRequestTone } from "./no3yPullRequestTone";

interface CardsProps {
  readonly lines: ReadonlyArray<PullRequestListLine>;
  readonly openPullRequest: (url: string) => Promise<boolean>;
  readonly actions: LinkedPullRequestActions;
}

/** Draws the cards in place of the upstream list it wraps while the redesign is on. */
export function No3yLinkedPullRequestCardsSwap(
  props: CardsProps & { readonly children: ReactElement },
) {
  const enabled = useNo3yBottomNavEnabled();
  if (!enabled) return props.children;
  return <No3yLinkedPullRequestCards {...props} />;
}

/** Consecutive lines of one stack share a chain key; pullRequestListLines keeps them together. */
function no3yPullRequestCards(lines: ReadonlyArray<PullRequestListLine>) {
  const cards: PullRequestListLine[][] = [];
  for (const line of lines) {
    const last = cards.at(-1);
    if (last !== undefined && last[0]!.chainKey === line.chainKey) last.push(line);
    else cards.push([line]);
  }
  return cards;
}

function No3yLinkedPullRequestCards(props: CardsProps) {
  const gt = useGT();
  const insets = useSafeAreaInsets();
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { lines } = props;
  const term = changeRequestTermKind(props.actions.terminology);
  const openCount = lines.filter(
    (line) => line.link.snapshot === null || line.link.snapshot.state === "open",
  ).length;
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom, 18) + 18,
      }}
    >
      {lines.length === 0 ? (
        <Text className="pt-6 text-center text-sm text-foreground-muted">
          {gt(
            "{term, select, mr {No linked merge requests.} cr {No linked change requests.} other {No linked pull requests.}}",
            { term },
          )}
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: 13, color: palette.sectionInk, marginHorizontal: 4 }}>
            {gt("{open} open · {linked} linked", { open: openCount, linked: lines.length })}
          </Text>
          {no3yPullRequestCards(lines).map((card) => (
            <View
              key={card[0]!.chainKey}
              style={{
                marginTop: 8,
                borderRadius: 20,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: palette.controlBorder,
                backgroundColor: palette.controlSurface,
                overflow: "hidden",
              }}
            >
              {card.length > 1 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingTop: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <HugeIcon icon={Layers01Icon} filled size={12} color={palette.metaInk} />
                  <Text style={{ fontSize: 12, color: palette.metaInk }}>
                    {gt("Stack of {size}", { size: card.length })}
                  </Text>
                </View>
              ) : null}
              {card.map((line, index) => (
                <Layer
                  key={linkedPullRequestKey(line)}
                  line={line}
                  divider={index > 0}
                  palette={palette}
                  openPullRequest={props.openPullRequest}
                  actions={props.actions}
                />
              ))}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const CHECKS_MARKS: Partial<
  Record<PullRequestChecksState, (palette: FlatGlassPalette) => ReactElement>
> = {
  failing: (palette) => <ChecksFailingMark color={palette.statusFailed} />,
  pending: (palette) => <ChecksRunningMark color={palette.statusAttention} />,
};

const REVIEW_INK: Partial<
  Record<PullRequestReviewDecision, (palette: FlatGlassPalette) => string>
> = {
  "changes-requested": (palette) => palette.statusFailed,
  approved: (palette) => palette.prOpen,
};

function Layer(props: {
  readonly line: PullRequestListLine;
  readonly divider: boolean;
  readonly palette: FlatGlassPalette;
  readonly openPullRequest: (url: string) => Promise<boolean>;
  readonly actions: LinkedPullRequestActions;
}) {
  const gt = useGT();
  const { palette } = props;
  const { link } = props.line;
  const model = useLinkedPullRequestModel(props.line, props.openPullRequest, true);
  const { snapshot, additions, deletions } = model;
  const tone = no3yPullRequestTone({
    state: snapshot?.state ?? null,
    isDraft: snapshot?.isDraft ?? false,
  });
  const pill = palette.prPill[tone];
  const checksMark =
    model.checks !== null && snapshot?.checksState ? CHECKS_MARKS[snapshot.checksState] : undefined;
  const reviewInk = snapshot?.reviewDecision ? REVIEW_INK[snapshot.reviewDecision] : undefined;
  const statuses = [
    model.conflict === null
      ? null
      : { key: "conflict", text: gt("Conflicts"), color: palette.statusFailed },
    model.review === null
      ? null
      : {
          key: "review",
          text: model.review.label,
          color: reviewInk?.(palette) ?? palette.metaInk,
        },
    model.watching ? { key: "watching", text: gt("Watching"), color: palette.metaInk } : null,
  ].filter((status) => status !== null);

  return (
    <LinkedPullRequestMenu link={link} actions={props.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={model.accessibilityLabel}
        accessibilityHint={model.accessibilityHint}
        onPress={model.onPress}
        style={({ pressed }) => ({
          gap: 6,
          // Siblings in a branching stack share a depth, so the indent shows what each layer sits on.
          paddingLeft: 12 + Math.min(props.line.depth, 3) * 12,
          paddingRight: 12,
          paddingTop: 10,
          paddingBottom: 11,
          borderTopWidth: props.divider ? StyleSheet.hairlineWidth : 0,
          borderColor: palette.controlBorder,
          backgroundColor: pressed ? palette.rowSelected : "transparent",
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
              #{link.number}
            </Text>
          </View>
          {checksMark?.(palette)}
          <View style={{ flex: 1 }} />
          {additions > 0 ? (
            <Text style={{ ...STAT, color: palette.prOpen }}>+{additions.toLocaleString()}</Text>
          ) : null}
          {deletions > 0 ? (
            <Text style={{ ...STAT, color: palette.statusFailed }}>
              −{deletions.toLocaleString()}
            </Text>
          ) : null}
          <HugeIcon icon={ArrowRight01Icon} size={14} color={palette.faintInk} />
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 15, lineHeight: 20, ...NO3Y_FONT.medium, color: palette.titleInk }}
        >
          {snapshot?.title ?? gt("Waiting for host state")}
        </Text>
        <Text style={{ fontSize: 13, color: palette.metaInk }}>
          {link.repository.split("/").at(-1)}
          {statuses.map((status) => (
            <Text key={status.key} style={{ color: status.color }}>
              {` · ${status.text}`}
            </Text>
          ))}
          {snapshot?.updatedAt ? (
            <>
              {" · "}
              <RelativeTime timestamp={snapshot.updatedAt} />
            </>
          ) : null}
        </Text>
      </Pressable>
    </LinkedPullRequestMenu>
  );
}

const STAT = { fontSize: 13, ...NO3Y_FONT.medium, fontVariant: ["tabular-nums" as const] };
