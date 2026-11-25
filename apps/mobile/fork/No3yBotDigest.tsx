/**
 * A Petal's digest on the no3y iPhone composer, as the Mac's BotDigestAsks draws it above its
 * composer — see `.fork/customizations.yaml#fork-bot-digest`: a glass card with the bot's status
 * line and pager, then one Needs you ask at a time with its tile, links, answers and Reply.
 */
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import CornerDownLeftIcon from "@hugeicons/core-free-icons/CornerDownLeftIcon";
import HelpCircleIcon from "@hugeicons/core-free-icons/HelpCircleIcon";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  type BotDigestItem,
  parseBotDigest,
  parseBotDigestStatus,
  quoteBotDigestAsk,
  splitBotDigestAsk,
} from "@t3tools/client-runtime/fork-bot-digest";
import {
  type BotDigestLinks,
  type BotPullRequest,
  resolveBotDigestLinks,
  waitingQuestionThread,
} from "@t3tools/client-runtime/fork-bot-digest-links";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { resolveFilesystemReadAccess } from "@t3tools/client-runtime/state/filesystem";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { isForkBotThread } from "@t3tools/shared/forkBotTags";
import { unknownThreadLinkLabel } from "@t3tools/shared/threadLinksCopy";
import { MessageId, type ProjectReadFileResult, type ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useMessages } from "gt-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import { useOpenThreadLink } from "../src/features/threads/useOpenThreadLink";
import { useNowMinuteMs } from "../src/lib/clock";
import { useUniwindTheme } from "../src/lib/useUniwindTheme";
import { makeQueuedMessageMetadata } from "../src/lib/commandMetadata";
import { useNavigateToPullRequest } from "../src/native/useOpenPullRequest";
import { useQuietThreadShell } from "../src/state/entities";
import { useEnvironmentPresentation } from "../src/state/presentation";
import { projectEnvironment } from "../src/state/projects";
import { useEnvironmentQuery } from "../src/state/query";
import { environmentSession } from "../src/state/session";
import { environmentThreadShells, threadEnvironment } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import {
  getComposerDraftSnapshot,
  rememberComposerDraftSelection,
  setComposerDraftText,
} from "../src/state/use-composer-drafts";
import { useThreadPr } from "../src/state/use-thread-pr";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { resolveNo3yThreadCardStatusKind } from "./mobileStatusGrouping";
import {
  clearNo3yBotDigestAnswer,
  markNo3yBotDigestAnswer,
  type No3yBotDigestConversation,
  useNo3yAnsweredBotDigestAsks,
  useNo3yBotDigestConversation,
  useNo3yBotDigestDismissed,
} from "./no3yBotDigestAnswers";
import { No3yBottomScrim } from "./No3yBottomFade";
import { NO3Y_PANEL_MARGIN, No3yGlassLayer } from "./No3yGlass";
import { NO3Y_GLASS_RISE_IN, NO3Y_LAYOUT } from "./no3yMotion";
import { NO3Y_PULL_REQUEST_GLYPHS } from "./No3yPullRequestMark";
import { no3yPullRequestColor, no3yPullRequestTone } from "./no3yPullRequestTone";
import { No3yStatusMark } from "./No3yStatusMark";

/** The Mac's BOT_DIGEST_FILE (custom/bots/botSeedFiles), in the bot's folder. */
const BOT_DIGEST_FILE = "DIGEST.md";
const CARD_RADIUS = 24;
const TILE_SIZE = 32;
const BUTTON_HEIGHT = 32;
const NO_DIGEST = Atom.make(AsyncResult.initial<ProjectReadFileResult, never>(false)).pipe(
  Atom.withLabel("no3y-bot-digest:none"),
);
// The revision each bot's digest was last read under, outliving the card's mount.
const readRevisions = new Map<string, string>();

/** The open thread's digest when it is a listed Petal; nothing for any other thread. */
export function No3yBotDigest(props: {
  readonly threadRef: ScopedThreadRef | null;
  readonly composerDraftKey: string | null;
  readonly canOperateThread: boolean;
}) {
  const bot = useQuietThreadShell(props.threadRef);
  const botKey =
    bot === null || bot.archivedAt !== null || !isForkBotThread(bot.source?.tags)
      ? null
      : scopedThreadKey(scopeThreadRef(bot.environmentId, bot.id));
  // Its answers are read off the conversation, so nothing draws until it loads.
  const conversation = useNo3yBotDigestConversation(botKey);
  if (bot === null || botKey === null || conversation === null) return null;
  // Keyed by the bot, so one Petal's page never carries over to the next.
  return (
    <BotDigestFor
      key={botKey}
      bot={bot}
      botKey={botKey}
      conversation={conversation}
      composerDraftKey={props.composerDraftKey}
      canOperateThread={props.canOperateThread}
    />
  );
}

function BotDigestFor(props: {
  readonly bot: EnvironmentThreadShell;
  readonly botKey: string;
  readonly conversation: No3yBotDigestConversation;
  readonly composerDraftKey: string | null;
  readonly canOperateThread: boolean;
}) {
  const { bot, botKey, conversation } = props;
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const screenColor = useUniwindTheme()["--color-screen"];
  const messages = useMessages();
  const session = useEnvironmentQuery(environmentSession.sessionStateAtom(bot.environmentId));
  const environment = useEnvironmentPresentation(bot.environmentId);
  const { canReadFiles } = resolveFilesystemReadAccess(
    {
      isCatalogReady: environment.isReady,
      connection: environment.presentation?.connection ?? null,
      session: session.data,
      sessionError: session.error,
    },
    messages,
  );
  const query =
    canReadFiles && bot.worktreePath !== null
      ? projectEnvironment.readFile({
          environmentId: bot.environmentId,
          input: { cwd: bot.worktreePath, relativePath: BOT_DIGEST_FILE, allowMissing: true },
        })
      : NO_DIGEST;
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  // The digest is a file on the bot's machine, rewritten during each run: a run starting or
  // ending reads it again.
  useEffect(() => {
    if (query === NO_DIGEST) return;
    const last = readRevisions.get(botKey);
    readRevisions.set(botKey, conversation.revision);
    if (last !== undefined && last !== conversation.revision) refresh();
  }, [botKey, conversation.revision, query, refresh]);
  const shells = useAtomValue(environmentThreadShells.quietThreadShellsAtom);
  const [dismissed, setDismissed] = useNo3yBotDigestDismissed(botKey);
  const [page, setPage] = useState(0);
  const startTurn = useAtomCommand(threadEnvironment.startTurn, { reportFailure: false });
  const openThread = useOpenThreadLink(bot.environmentId);

  const file = AsyncResult.getOrElse(result, () => null);
  const contents = file === null || file.exists === false ? null : file.contents;
  const allAsks =
    contents === null
      ? []
      : (parseBotDigest(contents).find((section) => section.kind === "needs-you")?.items ?? []);
  const status = contents === null ? null : parseBotDigestStatus(contents);
  // An answered ask goes away until the run that reads the answer settles and the digest is
  // read again; one the bot keeps then comes back.
  const answered = useNo3yAnsweredBotDigestAsks(botKey, conversation, result);
  const open = allAsks.filter((item) => !answered.has(item.source));
  const asks = open.filter((item) => !dismissed.includes(item.source));
  if (asks.length === 0 && status === null) return null;
  const at = Math.min(page, Math.max(0, asks.length - 1));
  const item = asks[at];

  const dismiss = (source: string) =>
    setDismissed([
      ...dismissed.filter((kept) => allAsks.some((ask) => ask.source === kept)),
      source,
    ]);
  // An answer goes to the bot as the owner's reply, quoting its ask, behind whatever it is doing.
  const answer = async (ask: BotDigestItem, choice: string) => {
    const metadata = makeQueuedMessageMetadata();
    const messageId = MessageId.make(metadata.messageId);
    markNo3yBotDigestAnswer(botKey, messageId, ask.source, conversation);
    const sent = await startTurn({
      environmentId: bot.environmentId,
      input: {
        threadId: bot.id,
        message: {
          messageId,
          role: "user",
          text: `${quoteBotDigestAsk(ask.source)}${choice}`,
          attachments: [],
        },
        runtimeMode: bot.runtimeMode,
        interactionMode: bot.interactionMode,
        dispatchMode: "queue",
        creationSource: "mobile",
        createdAt: metadata.createdAt,
      },
    });
    if (sent._tag === "Success") return;
    clearNo3yBotDigestAnswer(botKey, messageId);
    Dialog.alert(
      "Could not send your answer",
      "The Petal did not get it. Try again, or use Reply.",
    );
  };
  // An ask whose linked thread waits on a question opens that thread to answer it there; any
  // other is quoted into the composer beneath.
  const reply = (ask: BotDigestItem, question: EnvironmentThreadShell | undefined) => {
    if (question !== undefined) {
      openThread(scopeThreadRef(question.environmentId, question.id), question.title);
      return;
    }
    const draftKey = props.composerDraftKey;
    if (draftKey === null) return;
    const existing = getComposerDraftSnapshot(draftKey).text.trimEnd();
    const quote = quoteBotDigestAsk(ask.source);
    const next = existing === "" ? quote : `${existing}\n\n${quote}`;
    setComposerDraftText(draftKey, next);
    // The iOS editor otherwise keeps its old caret, so typing would land before the quote.
    rememberComposerDraftSelection(draftKey, next, { start: next.length, end: next.length });
  };

  const links = item === undefined ? null : resolveBotDigestLinks(item, shells, bot.environmentId);
  const text =
    item === undefined || links === null
      ? ""
      : item.text || links.threads.find((entry) => entry.shell)?.shell?.title || "";
  const ask = item === undefined ? null : splitBotDigestAsk(text);

  return (
    <Animated.View
      entering={NO3Y_GLASS_RISE_IN}
      layout={NO3Y_LAYOUT}
      // Under the banners above it, so its backdrop's fade never paints over their bottoms.
      style={{ zIndex: -1 }}
    >
      {/* The composer's own backdrop, so the transcript never reads through the card. */}
      <No3yBottomScrim color={screenColor} />
      <View style={{ ...NO3Y_PANEL_MARGIN, borderRadius: CARD_RADIUS }}>
        <No3yGlassLayer radius={CARD_RADIUS} />
        <DigestStrip
          palette={palette}
          status={status}
          count={asks.length}
          at={at}
          onPage={setPage}
          onDismiss={item === undefined ? null : () => dismiss(item.source)}
        />
        {item === undefined || links === null || ask === null ? null : (
          <View
            key={item.source}
            style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingBottom: 14 }}
          >
            <AskTile palette={palette} pullRequest={links.pullRequests[0] ?? null} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              {ask.question === "" ? null : (
                <Text
                  style={{
                    ...NO3Y_FONT.medium,
                    fontSize: 15,
                    lineHeight: 20,
                    color: palette.titleInk,
                  }}
                >
                  {ask.question}
                </Text>
              )}
              {ask.detail === null ? null : (
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 13, lineHeight: 17, color: palette.metaInk }}
                >
                  {ask.detail}
                </Text>
              )}
              <DigestLinks palette={palette} links={links} bot={bot} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 6 }}>
                {item.answers.map((choice) => (
                  <DigestButton
                    key={choice}
                    palette={palette}
                    label={choice}
                    outline
                    disabled={!props.canOperateThread}
                    onPress={() => void answer(item, choice)}
                  />
                ))}
                {/* Beside answers it is for anything else; alone it is the way to answer. */}
                <DigestButton
                  palette={palette}
                  label="Reply"
                  icon={CornerDownLeftIcon}
                  outline={item.answers.length === 0}
                  disabled={
                    props.composerDraftKey === null && waitingQuestionThread(links) === undefined
                  }
                  onPress={() => reply(item, waitingQuestionThread(links))}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** Where the bot stands, the pager (previous, a dot per ask, next), and the X that puts away the
    ask on show. */
function DigestStrip(props: {
  readonly palette: FlatGlassPalette;
  readonly status: string | null;
  readonly count: number;
  readonly at: number;
  readonly onPage: (index: number) => void;
  readonly onDismiss: (() => void) | null;
}) {
  const { palette, count, at, onPage } = props;
  return (
    <View
      style={{
        minHeight: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingLeft: 14,
        paddingRight: 8,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ flex: 1, minWidth: 0, fontSize: 13, color: palette.metaInk }}
      >
        {props.status ?? "Needs you"}
      </Text>
      {count < 2 ? null : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <StripButton
            palette={palette}
            icon={ArrowLeft01Icon}
            label="Previous ask"
            disabled={at === 0}
            onPress={() => onPage(at - 1)}
          />
          {/* A dot per ask, the one on show a rounded dash; each opens its ask. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            {Array.from({ length: count }, (_, index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Ask ${index + 1} of ${count}`}
                accessibilityState={{ selected: index === at }}
                hitSlop={6}
                onPress={() => onPage(index)}
                style={{
                  width: index === at ? 14 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: index === at ? palette.foreground : palette.faintInk,
                }}
              />
            ))}
          </View>
          <StripButton
            palette={palette}
            icon={ArrowRight01Icon}
            label="Next ask"
            disabled={at === count - 1}
            onPress={() => onPage(at + 1)}
          />
        </View>
      )}
      {props.onDismiss === null ? null : (
        <StripButton
          palette={palette}
          icon={Cancel01Icon}
          label="Dismiss"
          disabled={false}
          onPress={props.onDismiss}
        />
      )}
    </View>
  );
}

function StripButton(props: {
  readonly palette: FlatGlassPalette;
  readonly icon: HugeIconData;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        opacity: props.disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <HugeIcon icon={props.icon} size={16} color={props.palette.foreground} />
    </Pressable>
  );
}

function DigestButton(props: {
  readonly palette: FlatGlassPalette;
  readonly label: string;
  readonly icon?: HugeIconData;
  readonly outline: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { palette } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        height: BUTTON_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: props.outline ? 14 : 8,
        borderRadius: BUTTON_HEIGHT / 2,
        borderWidth: props.outline ? StyleSheet.hairlineWidth : 0,
        borderColor: palette.controlBorder,
        backgroundColor: props.outline ? palette.controlSurface : "transparent",
        opacity: props.disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {props.icon === undefined ? null : (
        <HugeIcon icon={props.icon} size={14} color={palette.foreground} />
      )}
      <Text style={{ ...NO3Y_FONT.medium, fontSize: 14, color: palette.foreground }}>
        {props.label}
      </Text>
    </Pressable>
  );
}

/** A pull request's state, as known: its thread link's snapshot, else its thread's badge when
    that badge is this pull request. */
type PullRequestState = { readonly state: "open" | "closed" | "merged"; readonly isDraft: boolean };

function WithPullRequestState(props: {
  readonly pullRequest: BotPullRequest & { readonly thread?: EnvironmentThreadShell | undefined };
  readonly children: (state: PullRequestState | null) => ReactNode;
}) {
  const { pullRequest } = props;
  if (pullRequest.snapshot !== null) return props.children(pullRequest.snapshot);
  if (pullRequest.thread === undefined) return props.children(null);
  return (
    <ThreadPullRequestState thread={pullRequest.thread} url={pullRequest.url}>
      {props.children}
    </ThreadPullRequestState>
  );
}

function ThreadPullRequestState(props: {
  readonly thread: EnvironmentThreadShell;
  readonly url: string;
  readonly children: (state: PullRequestState | null) => ReactNode;
}) {
  const pr = useThreadPr(props.thread);
  // A stack or multi-PR badge carries their combined state, not this pull request's.
  if (
    pr?.state == null ||
    pr.kind !== "pull-request" ||
    pr.others > 0 ||
    !sourceControlClients.isSameChangeRequest(pr.url, props.url)
  ) {
    return props.children(null);
  }
  return props.children({ state: pr.state, isDraft: pr.isDraft });
}

function pullRequestLook(state: PullRequestState | null, palette: FlatGlassPalette) {
  if (state === null) return { icon: NO3Y_PULL_REQUEST_GLYPHS.open, color: palette.metaInk };
  const tone = no3yPullRequestTone(state);
  return { icon: NO3Y_PULL_REQUEST_GLYPHS[tone], color: no3yPullRequestColor(tone, palette) };
}

/** The ask's tile: the state of the pull request it is about, else the needs-input question. */
function AskTile(props: {
  readonly palette: FlatGlassPalette;
  readonly pullRequest: BotDigestLinks["pullRequests"][number] | null;
}) {
  const tile = (icon: HugeIconData, color: string) => (
    <View
      style={{
        width: TILE_SIZE,
        height: TILE_SIZE,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.14 }]} />
      <HugeIcon icon={icon} size={16} color={color} />
    </View>
  );
  if (props.pullRequest === null) return tile(HelpCircleIcon, props.palette.statusAttention);
  return (
    <WithPullRequestState pullRequest={props.pullRequest}>
      {(state) => {
        const look = pullRequestLook(state, props.palette);
        return tile(look.icon, look.color);
      }}
    </WithPullRequestState>
  );
}

/** The threads and pull requests the ask links, each opening its target. */
function DigestLinks(props: {
  readonly palette: FlatGlassPalette;
  readonly links: BotDigestLinks;
  readonly bot: EnvironmentThreadShell;
}) {
  const { palette, links, bot } = props;
  const openThread = useOpenThreadLink(bot.environmentId);
  const navigateToPullRequest = useNavigateToPullRequest();
  const messages = useMessages();
  const nowMs = useNowMinuteMs();
  if (links.threads.length === 0 && links.pullRequests.length === 0) return null;
  const now = new Date(nowMs).toISOString();
  const chipText = { fontSize: 13, lineHeight: 17, color: palette.metaInk } as const;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
      {links.threads.map(({ link, label, shell }) =>
        shell === undefined ? (
          <Text key={`${link.environmentId}/${link.threadId}`} numberOfLines={1} style={chipText}>
            {label || unknownThreadLinkLabel(link, bot.environmentId, messages)}
          </Text>
        ) : (
          <Pressable
            key={`${shell.environmentId}/${shell.id}`}
            accessibilityRole="button"
            onPress={() => openThread(scopeThreadRef(shell.environmentId, shell.id), shell.title)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              maxWidth: "100%",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <No3yStatusMark
              kind={resolveNo3yThreadCardStatusKind(shell, { now })}
              palette={palette}
              idleMode="dot"
              size={14}
            />
            <Text numberOfLines={1} style={{ ...chipText, flexShrink: 1 }}>
              {shell.title}
            </Text>
          </Pressable>
        ),
      )}
      {links.pullRequests.map((pullRequest) => (
        <WithPullRequestState key={pullRequest.url} pullRequest={pullRequest}>
          {(state) => {
            const look = pullRequestLook(state, palette);
            return (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Pull request ${pullRequest.number}`}
                // Opened where its thread lives, which may be another environment; a bare link
                // opens from the Petal's.
                onPress={() => {
                  const owner = pullRequest.thread ?? bot;
                  void navigateToPullRequest(pullRequest.url, {
                    environmentId: owner.environmentId,
                    projectId: owner.projectId,
                  });
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <HugeIcon icon={look.icon} size={12} color={look.color} strokeWidth={1.5} />
                <Text style={{ ...chipText, color: look.color, fontVariant: ["tabular-nums"] }}>
                  {pullRequest.number}
                </Text>
              </Pressable>
            );
          }}
        </WithPullRequestState>
      ))}
    </View>
  );
}
