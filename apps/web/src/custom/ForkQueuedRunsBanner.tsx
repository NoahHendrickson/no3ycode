import { msg, useMessages } from "gt-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { deriveThreadQueueWorkflowState } from "@t3tools/client-runtime/state/thread-workflows";
import { resolveUserMessagePresentation } from "@t3tools/client-runtime/user-message";
import { assistantCitationsToPlainText } from "@t3tools/shared/assistantCitations";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import type {
  ChatAttachment as ContractChatAttachment,
  EnvironmentId,
  RunId,
  ThreadId,
} from "@t3tools/contracts";
import { ArrowUpIcon, BookmarkIcon, Clock3Icon, GripVerticalIcon, Trash2Icon } from "lucide-react";
import { useId, useImperativeHandle, useRef, useState, type Ref } from "react";

import { ListNumberIcon, PencilEditIcon } from "./icons/lucide-hugeicons";

import { useAssetUrls } from "~/assets/assetUrls";
import { m } from "~/i18n/messages";
import { MAX_STASH_ENTRIES } from "~/promptStashStore";
import { assetEnvironment } from "~/state/assets";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";
import { threadEnvironment } from "~/state/threads";
import { useQuietThreadProjection } from "~/state/entities";
import { useAtomCommand } from "~/state/use-atom-command";
import { isImageAttachment, type ChatMessage } from "~/types";
import { cn } from "~/lib/utils";
import { ComposerBanner } from "~/components/chat/ComposerBanner";
import type {
  EditQueuedRunRequest,
  QueuedRunsControlHandle,
} from "~/components/chat/QueuedRunsControl";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { toastManager } from "~/components/ui/toast";
import { extractTrailingDesignChanges } from "~/custom/designMode/designChangeTranscript";
import {
  loadQueuedImage,
  moveQueuedRunToStash,
  queuedRunStashBlockReason,
} from "~/custom/stashQueuedRun";

interface QueuedRowThumbnail {
  readonly key: string;
  readonly name: string;
  readonly url: string | null;
}

const QUEUED_RUN_DRAG_TYPE = "application/x-t3code-queued-run";

const SENDER_LABEL = { agent: "Agent", automation: "Automation", t3code: "T3 Code" } as const;

/** Who queued it, when it was not the owner typing: the guest's name, or the agent or automation. */
function queuedSender(
  message: Parameters<typeof resolveUserMessagePresentation>[0] | undefined,
): { readonly label: string; readonly guest: boolean } | null {
  if (!message) return null;
  const presentation = resolveUserMessagePresentation(message);
  if (presentation.attribution === "guest" && presentation.guestName !== undefined) {
    return { label: presentation.guestName, guest: true };
  }
  if (presentation.attribution === null || presentation.attribution === "guest") return null;
  return { label: SENDER_LABEL[presentation.attribution], guest: false };
}

type ThreadQueueProjection = Parameters<typeof deriveThreadQueueWorkflowState>[0];

function queuedImageResources(projection: ThreadQueueProjection | undefined) {
  if (!projection) return [];
  return deriveThreadQueueWorkflowState(projection).queuedRuns.flatMap(({ attachments }) =>
    attachments.flatMap((attachment) =>
      attachment.type === "image"
        ? [{ _tag: "attachment" as const, attachmentId: attachment.id }]
        : [],
    ),
  );
}

/** The collapsible "Queued" banner attached above the composer, with drag-to-reorder. */
export function ForkQueuedRunsBanner({
  ref,
  ...props
}: {
  readonly ref?: Ref<QueuedRunsControlHandle>;
  readonly steerShortcutLabel?: string | null;
  readonly editShortcutLabel?: string | null;
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly optimisticMessages: ReadonlyArray<
    Pick<ChatMessage, "id" | "inputIntent" | "text" | "attachments">
  >;
  readonly editingRunId: RunId | null;
  /** Set while something else holds the composer, such as an open question. */
  readonly editBlockedReason: string | null;
  readonly onEditQueuedRun: (request: EditQueuedRunRequest) => void;
  readonly onCancelEdit: () => void;
  /** Collapsed, the card leaves the dock and ChatView shows it as a pill in the chip row. */
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
}) {
  const messages = useMessages();
  const projection = useQuietThreadProjection(
    scopeThreadRef(props.environmentId, props.threadId),
  )?.projection;
  const reorder = useAtomCommand(threadEnvironment.reorderQueuedRun);
  const promote = useAtomCommand(threadEnvironment.promoteQueuedRun);
  const resume = useAtomCommand(threadEnvironment.resumeThreadQueue);
  const cancel = useAtomCommand(threadEnvironment.cancelQueuedRun);
  const createAssetUrl = useAtomQueryRunner(assetEnvironment.createUrl, {
    reportFailure: false,
    refresh: true,
  });
  const expanded = props.expanded;
  const queueListId = useId();
  const [busyRunId, setBusyRunId] = useState<RunId | null>(null);
  // Rows opened with "Read more", and the hovered row with whether its text is cut off.
  const [readKeys, setReadKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [hovered, setHovered] = useState<{
    readonly key: string;
    readonly overflowing: boolean;
  } | null>(null);
  // Read more is offered only while the row's text is cut off. An opened row wraps, so it
  // measures as fitting; it stays offered so Read less still folds back to Read more.
  const showReadMore = (row: HTMLElement, key: string) => {
    const text = row.querySelector<HTMLElement>("[data-fork-queued-text]");
    setHovered({
      key,
      overflowing: readKeys.has(key) || (text !== null && text.scrollWidth > text.clientWidth),
    });
  };
  const [dragState, setDragState] = useState<{
    readonly runId: RunId;
    readonly insertIndex: number | null;
  } | null>(null);
  // Drags start from the grip only, never from a text-drag on the row.
  const dragArmedRunIdRef = useRef<RunId | null>(null);
  const steerInFlightRef = useRef(false);
  // Run-only acknowledgements can resurrect pending rows after cancellation or startup.
  const acknowledgedMessageIds = new Set((projection?.messages ?? []).map((message) => message.id));
  const queuedImageAttachmentResources = queuedImageResources(projection);
  const queuedImageAttachmentUrls = useAssetUrls(
    props.environmentId,
    queuedImageAttachmentResources,
  );
  const workflow = projection ? deriveThreadQueueWorkflowState(projection, messages) : null;
  const queued = workflow?.queuedRuns ?? [];
  const activeRun = workflow?.activeRun ?? null;
  // A fresh message (armed by /clear) starts its own turn: it may skip compaction, but not steer.
  const canSendRun = (freshContext: boolean) =>
    workflow?.canSendNow === true ||
    (workflow?.canPromoteToSteer === true &&
      (!freshContext || workflow.promoteSkipsCompaction === true));
  const canReorder = queued.length > 1;
  const queuedImageUrlById = new Map(
    queuedImageAttachmentUrls.flatMap((url, index) => {
      const resource = queuedImageAttachmentResources[index];
      return url && resource ? [[resource.attachmentId, url] as const] : [];
    }),
  );
  const optimisticQueued = props.optimisticMessages.filter(
    (message) => message.inputIntent === "queued_turn" && !acknowledgedMessageIds.has(message.id),
  );
  const items = [
    ...queued.map(({ run, text, attachments, context, message }, serverIndex) => ({
      key: run.id,
      sender: queuedSender(message),
      runId: run.id,
      messageId: run.userMessageId,
      freshContext: run.freshContext === true,
      serverIndex,
      text,
      // A guest's message keeps the guest's words; the owner can cancel it, not rewrite it.
      editable: context?.guest === undefined,
      attachments,
      records: context?.records ?? [],
      // Without its message the row shows a placeholder, and stashing it would lose the real one.
      stashBlockedReason:
        message === undefined
          ? "This message is still loading"
          : queuedRunStashBlockReason({ text, attachments, guest: context?.guest !== undefined }),
      thumbnails: attachments
        .filter((attachment) => attachment.type === "image")
        .map<QueuedRowThumbnail>((attachment) => ({
          key: attachment.id,
          name: attachment.name,
          url: queuedImageUrlById.get(attachment.id) ?? null,
        })),
      pending: false,
    })),
    ...optimisticQueued.map((message) => ({
      key: message.id,
      sender: null,
      runId: null,
      messageId: null,
      freshContext: false,
      serverIndex: null,
      text: message.text,
      editable: true,
      attachments: [] as ReadonlyArray<ContractChatAttachment>,
      records: [],
      stashBlockedReason: null,
      thumbnails: (message.attachments ?? [])
        .filter(isImageAttachment)
        .map<QueuedRowThumbnail>((attachment) => ({
          key: attachment.id,
          name: attachment.name,
          url: attachment.previewUrl ?? null,
        })),
      pending: true,
    })),
  ];

  const move = async (runId: RunId, beforeRunId: RunId | null) => {
    setBusyRunId(runId);
    await reorder({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, runId, beforeRunId },
    });
    setBusyRunId(null);
  };

  const completeDrag = (runId: RunId, insertIndex: number | null) => {
    setDragState(null);
    dragArmedRunIdRef.current = null;
    if (insertIndex === null || busyRunId !== null) return;
    const draggedIndex = queued.findIndex(({ run }) => run.id === runId);
    if (draggedIndex === -1) return;
    if (insertIndex === draggedIndex || insertIndex === draggedIndex + 1) return;
    void move(runId, queued[insertIndex]?.run.id ?? null);
  };

  // Steers into the running turn, or starts a held queue with this message when idle.
  const sendQueuedMessage = async (queuedRunId: RunId) => {
    const freshContext = queued.some(
      ({ run }) => run.id === queuedRunId && run.freshContext === true,
    );
    if (!canSendRun(freshContext) || steerInFlightRef.current) return;
    steerInFlightRef.current = true;
    setBusyRunId(queuedRunId);
    const result = workflow?.canSendNow
      ? await resume({
          environmentId: props.environmentId,
          input: { threadId: props.threadId, runId: queuedRunId },
        })
      : activeRun !== null
        ? await promote({
            environmentId: props.environmentId,
            input: { threadId: props.threadId, queuedRunId, targetRunId: activeRun.id },
          })
        : null;
    steerInFlightRef.current = false;
    setBusyRunId(null);
    if (result?._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: m(msg("Could not send queued message")),
        description:
          error instanceof Error
            ? (thrownErrorMessage(error, m) ?? error.message)
            : m(msg("An error occurred.")),
      });
    }
  };

  useImperativeHandle(ref, () => ({
    steerNext(repeat) {
      const next = queued[0];
      if (!next || !canSendRun(next.run.freshContext === true)) return false;
      if (!repeat && busyRunId === null) void sendQueuedMessage(next.run.id);
      return true;
    },
    // Leave the key to caret navigation while editing.
    editLatest(repeat) {
      const latest = queued.at(-1);
      if (
        !latest ||
        latest.context?.guest !== undefined ||
        props.editingRunId !== null ||
        props.editBlockedReason !== null ||
        busyRunId !== null
      ) {
        return false;
      }
      if (!repeat) {
        props.onExpandedChange(true);
        props.onEditQueuedRun({
          runId: latest.run.id,
          messageId: latest.run.userMessageId,
          text: latest.text,
          attachments: latest.attachments,
        });
      }
      return true;
    },
  }));

  if (items.length === 0 || !expanded) return null;

  const remove = async (runId: RunId) => {
    setBusyRunId(runId);
    await cancel({
      environmentId: props.environmentId,
      input: { threadId: props.threadId, runId },
    });
    setBusyRunId(null);
  };

  const stash = async (item: (typeof items)[number]) => {
    const runId = item.runId;
    if (runId === null) return;
    setBusyRunId(runId);
    const outcome = await moveQueuedRunToStash({
      text: item.text,
      records: item.records,
      attachments: item.attachments,
      loadImage: (image) =>
        loadQueuedImage({ image, environmentId: props.environmentId, createAssetUrl }),
      cancel: async () =>
        (
          await cancel({
            environmentId: props.environmentId,
            input: { threadId: props.threadId, runId },
          })
        )._tag === "Success",
    });
    setBusyRunId(null);
    if (outcome._tag === "ImagesFailed") {
      toastManager.add({
        type: "error",
        title: "Could not stash this message",
        description: `${outcome.imageNames.join(", ")} could not be saved to the stash, so the message stays queued.`,
        data: { hideCopyButton: true },
      });
    }
    if (outcome._tag === "WriteFailed") {
      toastManager.add({
        type: "error",
        title: "Could not stash this message",
        description: "Browser storage rejected the write, so the message stays queued.",
        data: { hideCopyButton: true },
      });
    }
    if (outcome._tag !== "Moved") return;
    if (outcome.evicted) {
      toastManager.add({
        type: "warning",
        title: "Oldest stashed prompt discarded",
        description: `The stash holds ${MAX_STASH_ENTRIES} prompts; the oldest was removed to make room.`,
        data: { hideCopyButton: true },
      });
    }
    if (!outcome.durable) {
      toastManager.add({
        type: "warning",
        title: "Stashed message will not survive a reload",
        description:
          "Browser storage is unavailable, so this stash is kept in memory only for this session.",
        data: { hideCopyButton: true },
      });
    }
  };

  const sendLabel = workflow?.canSendNow ? "Send now" : "Steer";

  return (
    <ComposerBanner.Attachment>
      <ComposerBanner.Root
        role="region"
        aria-label={`${items.length} queued message${items.length === 1 ? "" : "s"}`}
        aria-live="polite"
        data-chat-composer-collapsed-controls="true"
        data-fork-queued-runs-banner="true"
        className="relative z-0"
      >
        <ComposerBanner.Row
          render={<button type="button" />}
          aria-label={expanded ? "Collapse queued messages" : "Expand queued messages"}
          aria-expanded={expanded}
          aria-controls={queueListId}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => props.onExpandedChange(!expanded)}
        >
          <ComposerBanner.Icon>
            <ListNumberIcon />
          </ComposerBanner.Icon>
          <ComposerBanner.Content className="font-medium text-muted-foreground">
            Queued
            <span className="font-normal text-muted-foreground/70 tabular-nums">
              {` ${items.length}`}
            </span>
          </ComposerBanner.Content>
          <ComposerBanner.Actions>
            <ComposerBanner.ToggleIcon expanded={expanded} />
          </ComposerBanner.Actions>
        </ComposerBanner.Row>
        <ComposerBanner.Scroll className={cn("max-h-32", !expanded && "hidden")}>
          <ComposerBanner.Children render={<ol />} id={queueListId}>
            {items.map((item) => {
              // Design-change blocks ride the queued text; the row names them instead of showing markup.
              const designChanges = extractTrailingDesignChanges(item.text);
              const designChangeLabel =
                designChanges.blocks.length > 0
                  ? `${designChanges.blocks.length} design change${designChanges.blocks.length === 1 ? "" : "s"}`
                  : null;
              const previewText = assistantCitationsToPlainText(
                replaceComposerContextReferences(
                  designChanges.promptText,
                  (reference) => reference.label,
                ),
              ).trim();
              const rowRunId = item.runId;
              const rowServerIndex = item.serverIndex;
              const isEditing = rowRunId !== null && rowRunId === props.editingRunId;
              const isRead = readKeys.has(item.key);
              const rowDraggable =
                rowRunId !== null && rowServerIndex !== null && canReorder && busyRunId === null;
              return (
                <ComposerBanner.Row
                  render={<li />}
                  key={item.key}
                  aria-current={isEditing ? "true" : undefined}
                  onPointerEnter={(event) => showReadMore(event.currentTarget, item.key)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={(event) => showReadMore(event.currentTarget, item.key)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null);
                  }}
                  className={cn(
                    "relative rounded-sm",
                    isEditing && "bg-accent text-accent-foreground",
                    dragState !== null && dragState.runId === item.runId && "opacity-50",
                  )}
                  draggable={rowDraggable}
                  onDragStart={(event) => {
                    if (item.runId === null || dragArmedRunIdRef.current !== item.runId) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData(QUEUED_RUN_DRAG_TYPE, item.runId);
                    event.dataTransfer.effectAllowed = "move";
                    setDragState({ runId: item.runId, insertIndex: null });
                  }}
                  onDragEnd={() => {
                    dragArmedRunIdRef.current = null;
                    setDragState(null);
                  }}
                  onDragOver={(event) => {
                    if (dragState === null || item.serverIndex === null) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const rect = event.currentTarget.getBoundingClientRect();
                    const insertIndex =
                      event.clientY < rect.top + rect.height / 2
                        ? item.serverIndex
                        : item.serverIndex + 1;
                    if (dragState.insertIndex !== insertIndex) {
                      setDragState({ runId: dragState.runId, insertIndex });
                    }
                  }}
                  onDrop={(event) => {
                    if (dragState === null) return;
                    event.preventDefault();
                    completeDrag(dragState.runId, dragState.insertIndex);
                  }}
                >
                  {item.serverIndex !== null && dragState?.insertIndex === item.serverIndex ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded bg-primary/70"
                    />
                  ) : null}
                  {item.serverIndex === queued.length - 1 &&
                  dragState?.insertIndex === queued.length ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded bg-primary/70"
                    />
                  ) : null}
                  <ComposerBanner.Icon aria-hidden={false}>
                    {canReorder && rowRunId !== null && rowServerIndex !== null ? (
                      <Button
                        size="icon-xs"
                        variant="ghost-muted"
                        aria-label="Reorder queued message (drag, or press the arrow keys)"
                        className="cursor-grab active:cursor-grabbing disabled:cursor-default"
                        disabled={busyRunId !== null}
                        onPointerDown={() => {
                          dragArmedRunIdRef.current = rowRunId;
                        }}
                        onKeyDown={(event) => {
                          if (busyRunId !== null) return;
                          if (event.key === "ArrowUp" && rowServerIndex > 0) {
                            event.preventDefault();
                            void move(rowRunId, queued[rowServerIndex - 1]?.run.id ?? null);
                          }
                          if (event.key === "ArrowDown" && rowServerIndex < queued.length - 1) {
                            event.preventDefault();
                            void move(rowRunId, queued[rowServerIndex + 2]?.run.id ?? null);
                          }
                        }}
                      >
                        <GripVerticalIcon />
                      </Button>
                    ) : null}
                  </ComposerBanner.Icon>
                  <ComposerBanner.Content className="text-sm text-foreground">
                    {isEditing ? <span className="sr-only">Editing queued message: </span> : null}
                    {item.pending ? (
                      <Clock3Icon
                        aria-label="Saving queued message"
                        className="size-3 shrink-0 text-muted-foreground/60"
                      />
                    ) : null}
                    {item.thumbnails.length > 0 ? (
                      <span className="flex shrink-0 items-center gap-0.5">
                        {item.thumbnails.map((thumbnail) => (
                          <span
                            key={thumbnail.key}
                            className="size-4 overflow-hidden rounded border border-border/70 bg-background"
                          >
                            {thumbnail.url ? (
                              <img
                                src={thumbnail.url}
                                alt={thumbnail.name}
                                className="size-full object-cover"
                              />
                            ) : (
                              <span
                                aria-label={thumbnail.name}
                                className="block size-full bg-muted/60"
                              />
                            )}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {item.sender ? (
                      <span
                        className={cn(
                          "shrink-0",
                          item.sender.guest ? "text-guest-foreground" : "text-muted-foreground",
                        )}
                      >
                        {item.sender.label}
                        {item.sender.guest ? <span className="sr-only"> (guest)</span> : null}
                      </span>
                    ) : null}
                    {designChangeLabel !== null ? (
                      <span className="shrink-0 text-muted-foreground">{designChangeLabel}</span>
                    ) : null}
                    <span
                      data-fork-queued-text
                      className={cn(
                        "min-w-0 flex-1",
                        isRead ? "py-2 break-words whitespace-pre-wrap" : "truncate",
                      )}
                    >
                      {previewText}
                    </span>
                    {isRead || (hovered?.key === item.key && hovered.overflowing) ? (
                      <button
                        type="button"
                        className="shrink-0 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setReadKeys((keys) => {
                            const next = new Set(keys);
                            if (isRead) next.delete(item.key);
                            else next.add(item.key);
                            return next;
                          })
                        }
                      >
                        {isRead ? "Read less" : "Read more"}
                      </button>
                    ) : null}
                  </ComposerBanner.Content>
                  <ComposerBanner.Actions>
                    {isEditing ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label="Cancel editing queued message"
                        onClick={props.onCancelEdit}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <>
                        {/* A /clear message cannot steer the running turn; like upstream, it offers no send. */}
                        {item.freshContext && !canSendRun(true) ? null : (
                          <Tooltip>
                            <TooltipTrigger render={<span className="flex shrink-0" />}>
                              <Button
                                size="icon-xs"
                                variant="ghost-muted"
                                aria-label={sendLabel}
                                disabled={
                                  item.runId === null ||
                                  busyRunId !== null ||
                                  !canSendRun(item.freshContext)
                                }
                                onClick={() => {
                                  if (item.runId !== null) void sendQueuedMessage(item.runId);
                                }}
                              >
                                <ArrowUpIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipPopup>
                              {!canSendRun(item.freshContext)
                                ? "There is no active run to steer"
                                : `${workflow?.canSendNow ? "Start a turn with this message" : workflow?.promoteSkipsCompaction ? "Skip compaction and send this message" : "Send as a steer instead"}${item.serverIndex === 0 && props.steerShortcutLabel ? ` (${props.steerShortcutLabel})` : ""}`}
                            </TooltipPopup>
                          </Tooltip>
                        )}
                        <Tooltip>
                          {/* The span keeps the tooltip, and its reason, on a disabled button. */}
                          <TooltipTrigger render={<span className="flex shrink-0" />}>
                            <Button
                              size="icon-xs"
                              variant="ghost-muted"
                              aria-label="Edit queued message"
                              disabled={
                                item.runId === null ||
                                !item.editable ||
                                busyRunId !== null ||
                                props.editBlockedReason !== null
                              }
                              onClick={() => {
                                if (item.runId !== null && item.messageId !== null) {
                                  props.onEditQueuedRun({
                                    runId: item.runId,
                                    messageId: item.messageId,
                                    text: item.text,
                                    attachments: item.attachments,
                                  });
                                }
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipPopup>
                            {props.editBlockedReason ??
                              `Edit in the composer${item.serverIndex === queued.length - 1 && props.editShortcutLabel ? ` (${props.editShortcutLabel})` : ""}`}
                          </TooltipPopup>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={<span className="flex shrink-0" />}>
                            <Button
                              size="icon-xs"
                              variant="ghost-muted"
                              aria-label="Move queued message to stash"
                              disabled={
                                item.runId === null ||
                                busyRunId !== null ||
                                item.stashBlockedReason !== null
                              }
                              onClick={() => void stash(item)}
                            >
                              <BookmarkIcon weight="stroke" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipPopup>{item.stashBlockedReason ?? "Move to stash"}</TooltipPopup>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                size="icon-xs"
                                variant="ghost-muted"
                                aria-label="Remove queued message"
                                disabled={item.runId === null || busyRunId !== null}
                                onClick={() => {
                                  if (item.runId !== null) void remove(item.runId);
                                }}
                              />
                            }
                          >
                            <Trash2Icon weight="stroke" />
                          </TooltipTrigger>
                          <TooltipPopup>Remove from queue</TooltipPopup>
                        </Tooltip>
                      </>
                    )}
                  </ComposerBanner.Actions>
                </ComposerBanner.Row>
              );
            })}
          </ComposerBanner.Children>
        </ComposerBanner.Scroll>
      </ComposerBanner.Root>
    </ComposerBanner.Attachment>
  );
}
