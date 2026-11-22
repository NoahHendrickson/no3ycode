/**
 * The Mac fork's "Queued · N" banner on the no3y iPhone composer (`.fork/customizations.yaml#fork-queued-runs-banner`):
 * a collapsible glass card right above the composer card with one line per queued message, Send
 * now / Steer, Edit and Remove on each, and Move up / Move down in its long-press menu.
 */
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUp02Icon from "@hugeicons/core-free-icons/ArrowUp02Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import LeftToRightListNumberIcon from "@hugeicons/core-free-icons/LeftToRightListNumberIcon";
import PencilEdit02Icon from "@hugeicons/core-free-icons/PencilEdit02Icon";
import { useAtomValue } from "@effect/atom-react";
import {
  makeQueuedRunsAtom,
  queuedRunEditBlockedReason,
} from "@t3tools/client-runtime/queued-run-edit";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentId, RunId, ThreadId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  buildCancelQueuedRunCommand,
  resolveThreadQueueRowControls,
} from "../src/features/threads/threadQueueControlPresentation";
import { scopedThreadKey } from "../src/lib/scopedEntities";
import { beginQueuedRunEdit, useQueuedRunEdit } from "../src/state/queued-run-edit";
import { environmentThreadDetails, threadEnvironment } from "../src/state/threads";
import { useAtomCommand } from "../src/state/use-atom-command";
import { flatGlassPalette, NO3Y_FONT, type FlatGlassPalette } from "./flatGlassTheme";
import { HugeIcon, type HugeIconData } from "./HugeIcon";
import { No3yGlassLayer } from "./No3yGlass";
import { no3yPromptStash, stashPromptText } from "./No3yPromptStashSheet";
import { no3yQueuedSender, no3yQueueMove } from "./no3yQueuedRuns";

const RADIUS = 22;

type RowAction = "steer" | "edit" | "remove" | "up" | "down" | "stash";

export function No3yQueuedRunsBanner(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
}) {
  const target = { environmentId: props.environmentId, threadId: props.threadId };
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const workflow = useAtomValue(environmentThreadDetails.queueWorkflowAtom(target));
  const threadKey = scopedThreadKey(props.environmentId, props.threadId);
  const editing = useQueuedRunEdit(threadKey);
  const pendingRequests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(target));
  const editBlockedReason = queuedRunEditBlockedReason({
    openQuestionCount: pendingRequests?.userInputs.length ?? 0,
  });
  const promote = useAtomCommand(threadEnvironment.promoteQueuedRun, "promote queued message");
  const cancel = useAtomCommand(threadEnvironment.cancelQueuedRun, "remove queued message");
  const resume = useAtomCommand(threadEnvironment.resumeThreadQueue, "resume queue");
  const reorder = useAtomCommand(threadEnvironment.reorderQueuedRun, "reorder queued message");
  const resumeHeldQueue = useAtomCommand(threadEnvironment.resumeThreadQueue, {
    label: "resume queue",
    reportFailure: false,
  });
  const [expanded, setExpanded] = useState(true);
  const [busyRunId, setBusyRunId] = useState<RunId | null>(null);
  const [resuming, setResuming] = useState(false);
  const busyRef = useRef(false);
  const queuedRuns = workflow?.queuedRuns ?? [];
  if (queuedRuns.length === 0) return null;
  const runIds = queuedRuns.map(({ run }) => run.id);
  const canSend = workflow?.canPromoteToSteer === true || workflow?.canSendNow === true;
  const sendLabel = workflow?.canSendNow ? "Send now" : "Steer";

  const act = async (runId: RunId, action: RowAction) => {
    if (busyRef.current) return;
    const entry = queuedRuns.find(({ run }) => run.id === runId);
    if (entry === undefined) return;
    if (action === "edit") {
      if (editBlockedReason !== null) return;
      void Haptics.selectionAsync();
      beginQueuedRunEdit(
        threadKey,
        {
          runId,
          messageId: entry.messageId,
          originalText: entry.text,
          existingAttachments: entry.attachments,
          ...(entry.context ? { context: entry.context } : {}),
        },
        makeQueuedRunsAtom({
          threadId: props.threadId,
          snapshot: threadEnvironment.snapshotAtom(props.environmentId),
          detailStatus: environmentThreadDetails.statusAtom(target),
          runs: Atom.make(
            (get) => get(environmentThreadDetails.quietThreadAtom(target))?.projection.runs ?? null,
          ),
        }),
      );
      return;
    }
    busyRef.current = true;
    setBusyRunId(runId);
    void Haptics.selectionAsync();
    if (action === "remove") {
      await cancel(buildCancelQueuedRunCommand({ ...target, runId }));
    } else if (action === "stash") {
      // Written first and taken back if the run can't be removed, as the Mac's stashQueuedRun does.
      const id = stashPromptText(entry.text, null);
      const result = await cancel(buildCancelQueuedRunCommand({ ...target, runId }));
      if (result._tag === "Failure") no3yPromptStash.remove(id);
    } else if (action === "up" || action === "down") {
      const move = no3yQueueMove(runIds, runId, action);
      if (move !== null) await reorder({ ...target, input: { threadId: props.threadId, ...move } });
    } else if (workflow?.canSendNow) {
      // Starts a held queue with this message when the thread is idle.
      await resume({ ...target, input: { threadId: props.threadId, runId } });
    } else if (workflow?.activeRun && workflow.canPromoteToSteer) {
      await promote({
        ...target,
        input: {
          threadId: props.threadId,
          queuedRunId: runId,
          targetRunId: workflow.activeRun.id,
        },
      });
    }
    busyRef.current = false;
    setBusyRunId(null);
  };

  const resumeQueue = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setResuming(true);
    const result = await resumeHeldQueue({ ...target, input: { threadId: props.threadId } });
    busyRef.current = false;
    setResuming(false);
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      Dialog.alert("Could not resume queue", error instanceof Error ? error.message : "Try again.");
    }
  };

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 6, borderRadius: RADIUS }}>
      <No3yGlassLayer radius={RADIUS} />
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 44 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${queuedRuns.length} queued message${queuedRuns.length === 1 ? "" : "s"}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingLeft: 16,
            paddingRight: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <HugeIcon icon={LeftToRightListNumberIcon} size={16} color={palette.quietInk} />
          <Text style={{ flex: 1, fontSize: 14, ...NO3Y_FONT.medium, color: palette.quietInk }}>
            {workflow?.isHeld ? "Queue paused" : "Queued"}
            <Text style={{ color: palette.metaInk, fontVariant: ["tabular-nums"] }}>
              {` · ${queuedRuns.length}`}
            </Text>
          </Text>
          <HugeIcon
            icon={expanded ? ArrowDown01Icon : ArrowUp01Icon}
            size={14}
            color={palette.quietInk}
          />
        </Pressable>
        {workflow?.isHeld ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resume queue"
            disabled={resuming || busyRunId !== null}
            hitSlop={8}
            onPress={() => void resumeQueue()}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              opacity: resuming ? 0.45 : pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ fontSize: 14, ...NO3Y_FONT.medium, color: palette.foreground }}>
              Resume
            </Text>
          </Pressable>
        ) : null}
      </View>
      {expanded
        ? queuedRuns.map(({ run, text, attachments, context, message }, index) => {
            const controls = resolveThreadQueueRowControls({
              busy: busyRunId !== null,
              // A fresh message starts its own turn: it may skip compaction, but not steer into one.
              canPromoteToSteer:
                (workflow?.canPromoteToSteer ?? false) &&
                (run.freshContext !== true || workflow?.promoteSkipsCompaction === true),
              canSendNow: workflow?.canSendNow ?? false,
              editBlocked: editBlockedReason !== null,
              isEditing: editing?.runId === run.id,
              isGuestMessage: context?.guest !== undefined,
              text,
            });
            const sender = no3yQueuedSender(message);
            const title =
              controls.displayText || (attachments.length > 0 ? "Attachments" : "Queued message");
            return (
              <QueuedRow
                key={run.id}
                palette={palette}
                index={index}
                count={queuedRuns.length}
                title={title}
                attachmentCount={controls.displayText ? attachments.length : 0}
                sender={sender?.label ?? null}
                isEditing={controls.isEditing}
                canSend={canSend && controls.canSend}
                showSend={canSend}
                sendLabel={sendLabel}
                canEdit={controls.canEdit}
                editHint={editBlockedReason}
                canRemove={controls.canDismiss}
                // The stash keeps text only, and a guest's words are not the owner's to keep.
                canStash={
                  controls.canDismiss &&
                  attachments.length === 0 &&
                  context?.guest === undefined &&
                  text.trim().length > 0
                }
                canReorder={busyRunId === null}
                onAction={(action) => void act(run.id, action)}
              />
            );
          })
        : null}
    </View>
  );
}

function QueuedRow(props: {
  readonly palette: FlatGlassPalette;
  readonly index: number;
  readonly count: number;
  readonly title: string;
  readonly attachmentCount: number;
  readonly sender: string | null;
  readonly isEditing: boolean;
  readonly canSend: boolean;
  readonly showSend: boolean;
  readonly sendLabel: string;
  readonly canEdit: boolean;
  readonly editHint: string | null;
  readonly canRemove: boolean;
  readonly canStash: boolean;
  readonly canReorder: boolean;
  readonly onAction: (action: RowAction) => void;
}) {
  const { palette } = props;
  const position = `queued message ${props.index + 1}`;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        paddingRight: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: palette.hairline,
      }}
    >
      <Menu
        accessibilityLabel={`Actions for ${position}`}
        shouldOpenOnLongPress
        style={{ flex: 1 }}
        actions={[
          ...(props.showSend
            ? [
                {
                  id: "steer",
                  title: props.sendLabel,
                  attributes: { disabled: !props.canSend },
                  image: "arrow.up",
                },
              ]
            : []),
          { id: "edit", title: "Edit", attributes: { disabled: !props.canEdit }, image: "pencil" },
          ...(props.count > 1
            ? [
                {
                  id: "up",
                  title: "Move up",
                  attributes: { disabled: !props.canReorder || props.index === 0 },
                  image: "arrow.up.to.line",
                },
                {
                  id: "down",
                  title: "Move down",
                  attributes: { disabled: !props.canReorder || props.index === props.count - 1 },
                  image: "arrow.down.to.line",
                },
              ]
            : []),
          ...(props.canStash
            ? [{ id: "stash", title: "Move to stash", image: "tray.and.arrow.down" }]
            : []),
          {
            id: "remove",
            title: "Remove",
            attributes: { disabled: !props.canRemove, destructive: true },
            image: "trash",
          },
        ]}
        onPressAction={({ nativeEvent }) => props.onAction(nativeEvent.event as RowAction)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.sender ? `${props.sender}: ${props.title}` : props.title}
          accessibilityHint={
            props.canEdit
              ? "Opens this message in the composer for editing"
              : (props.editHint ?? undefined)
          }
          disabled={!props.canEdit}
          onPress={() => props.onAction("edit")}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingLeft: 16,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 15,
              color: props.isEditing ? palette.metaInk : palette.titleInk,
            }}
          >
            {props.sender ? (
              <Text style={{ ...NO3Y_FONT.medium, color: palette.quietInk }}>
                {`${props.sender}  `}
              </Text>
            ) : null}
            {props.title}
          </Text>
          {props.attachmentCount > 0 ? (
            <Text style={{ fontSize: 13, color: palette.metaInk }}>
              {`+${props.attachmentCount}`}
            </Text>
          ) : null}
          {props.isEditing ? (
            <Text style={{ fontSize: 13, ...NO3Y_FONT.medium, color: palette.metaInk }}>
              Editing
            </Text>
          ) : null}
        </Pressable>
      </Menu>
      {props.showSend ? (
        <RowButton
          palette={palette}
          icon={ArrowUp02Icon}
          label={`${props.sendLabel}, ${position}`}
          disabled={!props.canSend}
          onPress={() => props.onAction("steer")}
        />
      ) : null}
      <RowButton
        palette={palette}
        icon={PencilEdit02Icon}
        label={`Edit ${position}`}
        disabled={!props.canEdit}
        onPress={() => props.onAction("edit")}
      />
      <RowButton
        palette={palette}
        icon={Delete02Icon}
        label={`Remove ${position}`}
        disabled={!props.canRemove}
        onPress={() => props.onAction("remove")}
      />
    </View>
  );
}

function RowButton(props: {
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
      hitSlop={4}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        opacity: props.disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <HugeIcon icon={props.icon} size={16} color={props.palette.foreground} />
    </Pressable>
  );
}
