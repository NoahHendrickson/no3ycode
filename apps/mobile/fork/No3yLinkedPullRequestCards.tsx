/**
 * The Linked pull requests sheet as the Agents sheet's glass cards
 * (`.fork/customizations.yaml#no3y-linked-pr-row`): one card per stack, each layer led by its
 * number on the status pill's tinted pull request pill, then its title and repository.
 */
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import type { PullRequestListLine } from "@t3tools/client-runtime/thread-pull-requests";
import { useGT, useMessages } from "gt-react-native";
import type { ReactElement } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RelativeTime } from "../src/components/RelativeTime";
import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { changeRequestTermKind } from "../src/lib/changeRequestTerm";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { pullRequestListReviewStatus } from "../src/features/pull-requests/pullRequestList";
import {
  pullRequestConflict,
  pullRequestStatus,
} from "../src/features/pull-requests/pullRequestStatus";
import { linkedPullRequestKey } from "../src/features/threads/LinkedPullRequestList";
import type { LinkedPullRequestActions } from "../src/features/threads/useLinkedPullRequestActions";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { useNo3yBottomNavEnabled } from "./no3yBottomNavEnabled";
import { NO3Y_PULL_REQUEST_GLYPHS } from "./No3yPullRequestMark";
import { no3yPullRequestTone } from "./no3yPullRequestTone";
import { ChecksFailingMark, ChecksRunningMark } from "./No3yStatusPill";

interface CardsProps {
  readonly lines: ReadonlyArray<PullRequestListLine>;
  readonly summary: string | null;
  readonly emptyLabel: string;
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
export function no3yPullRequestCards(lines: ReadonlyArray<PullRequestListLine>) {
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
      {props.summary !== null ? (
        <Text style={{ fontSize: 13, color: palette.sectionInk, marginHorizontal: 4 }}>
          {props.summary}
        </Text>
      ) : null}
      {props.lines.length === 0 ? (
        <Text className="pt-6 text-center text-sm text-foreground-muted">{props.emptyLabel}</Text>
      ) : (
        no3yPullRequestCards(props.lines).map((card) => (
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
        ))
      )}
    </ScrollView>
  );
}

function Layer(props: {
  readonly line: PullRequestListLine;
  readonly divider: boolean;
  readonly palette: FlatGlassPalette;
  readonly openPullRequest: (url: string) => Promise<boolean>;
  readonly actions: LinkedPullRequestActions;
}) {
  const gt = useGT();
  const messages = useMessages();
  const { palette, actions } = props;
  const { link } = props.line;
  const snapshot = link.snapshot;
  const open = snapshot === null || snapshot.state === "open";
  const tone = no3yPullRequestTone({
    state: snapshot?.state ?? null,
    isDraft: snapshot?.isDraft ?? false,
  });
  const pill = palette.prPill[tone];
  const checks = open ? (snapshot?.checksState ?? null) : null;
  const review =
    open && snapshot?.reviewDecision
      ? pullRequestListReviewStatus(
          { reviewDecision: snapshot.reviewDecision, viewerReviewRequested: false },
          messages,
        )
      : null;
  const status = snapshot === null ? null : pullRequestStatus(snapshot, messages);
  const conflicts = snapshot !== null && pullRequestConflict(snapshot, messages) !== null;
  const watching = open && link.watch !== undefined;
  const additions = snapshot?.additions ?? 0;
  const deletions = snapshot?.deletions ?? 0;
  const repository = link.repository.split("/").at(-1) ?? link.repository;
  const term = changeRequestTermKind(
    (sourceControlClients.findByChangeRequestUrl(link.url) ?? sourceControlClients.get(undefined))
      .changeRequest,
  );
  const meta: Array<{ readonly text: string; readonly spoken?: string; readonly color: string }> = [
    { text: repository, color: palette.metaInk },
  ];
  if (conflicts) meta.push({ text: gt("Conflicts"), color: palette.statusFailed });
  if (review !== null)
    meta.push({
      text: review.label,
      spoken: review.accessibleLabel,
      color:
        snapshot?.reviewDecision === "changes-requested"
          ? palette.statusFailed
          : snapshot?.reviewDecision === "approved"
            ? palette.prOpen
            : palette.metaInk,
    });
  if (watching) meta.push({ text: gt("Watching"), color: palette.metaInk });

  const card = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        gt(
          "{term, select, mr {Merge request {number}, {title}} cr {Change request {number}, {title}} other {Pull request {number}, {title}}}",
          { term, number: link.number, title: snapshot?.title ?? gt("waiting for host state") },
        ),
        status?.label,
        link.repository,
        ...meta.slice(1).map((item) => item.spoken ?? item.text),
        checks === "failing"
          ? gt("checks failing")
          : checks === "pending"
            ? gt("checks pending")
            : checks === "passing"
              ? gt("checks passing")
              : null,
      ]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint={gt("Touch and hold for actions.")}
      onPress={() => {
        void props.openPullRequest(link.url).then((opened) => {
          if (!opened)
            Dialog.alert(
              gt(
                "{term, select, mr {Unable to open MR} cr {Unable to open change request} other {Unable to open PR}}",
                { term },
              ),
              gt(
                "{term, select, mr {The merge request could not be opened.} cr {The change request could not be opened.} other {The pull request could not be opened.}}",
                { term },
              ),
            );
        });
      }}
      style={({ pressed }) => ({
        gap: 6,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 11,
        borderTopWidth: props.divider ? StyleSheet.hairlineWidth : 0,
        borderColor: palette.controlBorder,
        backgroundColor: pressed ? palette.rowSelected : "transparent",
      })}
    >
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 4 }}
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
        {checks === "failing" ? <ChecksFailingMark color={palette.statusFailed} /> : null}
        {checks === "pending" ? <ChecksRunningMark color={palette.statusAttention} /> : null}
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
        {meta.map((item, index) => (
          <Text key={item.text} style={{ color: item.color }}>
            {index > 0 ? " · " : ""}
            {item.text}
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
  );
  return (
    <Menu
      shouldOpenOnLongPress
      title={`#${link.number} · ${link.repository}`}
      actions={actions.menuActions(link)}
      onPressAction={({ nativeEvent }) => actions.onMenuAction(link, nativeEvent.event)}
    >
      {card}
    </Menu>
  );
}

const STAT = { fontSize: 13, ...NO3Y_FONT.medium, fontVariant: ["tabular-nums" as const] };
