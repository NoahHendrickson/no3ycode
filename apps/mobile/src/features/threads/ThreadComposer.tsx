import { Button } from "../../components/ui/Button";
import * as Dialog from "../../components/ui/Dialog";
import type { ComposerTextPaste } from "../../native/T3ComposerEditor.types";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { AsyncResult } from "effect/reactivity";
import { useAtomValue } from "@effect/atom-react";
import { clampFileAttachmentUploadBytes } from "@t3tools/client-runtime/state/attachments";
import { pastedTextDisposition, replaceTextSelection } from "@t3tools/client-runtime/text-paste";
import {
  AuthOrchestrationOperateScope,
  PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
  PROVIDER_SEND_TURN_MAX_INPUT_CHARS,
  type ChatAttachment,
  type EnvironmentId,
  type MessageId,
  type ModelSelection,
  type ServerConfig as T3ServerConfig,
  type UsageLimitsReport,
} from "@t3tools/contracts";
import {
  collectProviderUsageLimits,
  hasProviderUsageLimits,
  isUsageLimitsCommand,
} from "@t3tools/shared/usageLimits";
import { StackActions, useFocusEffect, useNavigation } from "@react-navigation/native";
import { msg, T, useGT, useMessages } from "gt-react-native";
import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { Keyboard, Platform, View } from "react-native";
import { composerImageGallery } from "../../lib/composerImageGallery";
import { filePreviewGallery } from "../../lib/filePreviewGallery";
import { FilePreviewModal, type FilePreviewSource } from "../../components/ui/FilePreviewModal";
import {
  composerAttachmentUploadBlockReason,
  composerAttachmentsStillUploading,
  composerAttachmentUploadsAtom,
} from "../../state/composer-attachment-uploads";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { themeColorWithAlpha } from "../../lib/mobileTheme";
import { armAgentAwarenessLiveActivityForLocalWork } from "../agent-awareness/remoteRegistration";
import { scopedThreadKey } from "../../lib/scopedEntities";
import {
  getComposerDraftSnapshot,
  setComposerDraftText,
  composerContextImportsAtom,
  countComposerDraftAttachmentsAfterSelection,
  useComposerDraft,
  useComposerDraftResetGeneration,
} from "../../state/use-composer-drafts";
import type { ComposerDocumentAttachment } from "../../lib/composerContext";
import { useProject, useVisibleThreadShells } from "../../state/entities";
import { useMentionableEnvironments } from "../../state/environments";
import { useLinkedEnvironments } from "../../state/peerLinks";
import { useEnvironmentScopeDenied } from "../../state/session";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";

import { SymbolView } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { ComposerAttachmentButton } from "./ComposerAttachmentButton";
import {
  ComposerAttachmentStrip,
  ComposerAttachmentThumbnail,
} from "../../components/ComposerAttachmentStrip";
import { VideoPreviewModal, type VideoPreviewSource } from "../../components/ui/VideoPreviewModal";
import { ComposerEditor, type ComposerEditorHandle } from "../../components/ComposerEditor";
import {
  COMPOSER_BOTTOM_GUTTER,
  COMPOSER_TRANSITION_DURATION_MS,
  ComposerSurface,
  INLINE_EDITOR_MIN_WIDTH,
  useComposerChrome,
  useCompactComposerEditor,
} from "../../components/ComposerSurface";
import { fileRoutePathSegments } from "../files/filePath";
import {
  ComposerActionButton,
  ComposerInlineControl,
  ComposerToolbarRow,
} from "../../components/ComposerToolbar";
import { formatTokens } from "@t3tools/shared/usageFormat";
import { ComposerModelControl } from "../../components/ComposerModelControl";
import {
  composerStripAttachments,
  type DraftComposerFileAttachment,
} from "../../lib/composerImages";
import { composerAttachmentUploadKey } from "../../lib/composerAttachmentUploadQueue";
import {
  buildModelOptions,
  isModelSelectionUnavailable,
  serverConfigForCwd,
} from "../../lib/modelOptions";
import { useComposerTextRole } from "../settings/appearance/useScaledTextRole";
import type { RemoteClientConnectionState } from "../../lib/connection";
import { Menu } from "../../components/ui/Menu";
import {
  composerRunsDraftLocally,
  type ActiveTurnComposerAction,
} from "@t3tools/client-runtime/state/composer-dispatch";
import type { FollowUpBehavior } from "../../lib/followUpBehavior";
import {
  resolveComposerSendPresentation,
  type ComposerSendPresentation,
} from "./composerSendPresentation";
import { useSubmitAfterNativeImages } from "./useSubmitAfterNativeImages";
import { ComposerCommandPopover } from "./ComposerCommandPopover";
import { ComposerPopoverAnchor } from "./ComposerPopoverAnchor";
import { ComposerQueuedEditAttachments } from "./ComposerQueuedEdit";
import { useComposerCommandMenu } from "./use-composer-command-menu";
import type { ComposerEnvironmentCandidate } from "@t3tools/client-runtime/composerThreadItems";
import { offersLinkedEnvironments } from "@t3tools/client-runtime/link-request";
import {
  ComposerDictationCancelAction,
  ComposerDictationDraftContent,
  ComposerDictationError,
  ComposerDictationPrimaryAction,
  ComposerDictationStartAction,
  ComposerDictationStatus,
  ComposerDictationToolbar,
} from "../voice-input/ComposerDictationControl";
import { useVoiceInputController } from "../voice-input/useVoiceInputController";
import { resolveVoiceComposerPresentation } from "../voice-input/voiceInputPresentation";
import type { ExistingThreadSettingsRouteParams } from "./ThreadSettingsSheet";
import {
  useThreadSettingsSheetPresentation,
  type NavigationWithFinishTransitioning,
} from "./use-thread-settings-sheet-presentation";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import { useNo3yBottomNavEnabled } from "../../../fork/no3yBottomNavEnabled";
import { No3yBottomScrim } from "../../../fork/No3yBottomFade";
import { NO3Y_COMPOSER_CONTROL_SIZE } from "../../../fork/flatGlassTheme";
/* fork:end no3y-mobile-redesign */

/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
/** The no3y card's inset on every side; the editor adds as much again so text sits 24pt in. */
const NO3Y_CARD_INSET = 12;
/**
 * The editor's bottom above its row's bottom: the controls' top in their 44pt toolbar row, plus
 * the card inset, so the last line sits as far above the controls as the first sits below the top.
 */
const NO3Y_CARD_CONTROLS_CLEARANCE = 44 / 2 + NO3Y_COMPOSER_CONTROL_SIZE / 2 + NO3Y_CARD_INSET;
/* fork:end no3y-mobile-redesign */

export const COMPOSER_COLLAPSED_CHROME = 60;
export const THREAD_COMPOSER_BOTTOM_GUTTER = COMPOSER_BOTTOM_GUTTER;

const NO_MACHINES: ReadonlyArray<ComposerEnvironmentCandidate> = [];

export interface ThreadComposerProps {
  readonly isDraft?: boolean;
  readonly canOperateThread: boolean;
  readonly placeholder: string;
  readonly contentMaxWidth?: number;
  readonly draftControls?: ReactNode;
  readonly bottomInset?: number;
  readonly connectionState: RemoteClientConnectionState;
  readonly environmentLabel: string | null;
  readonly selectedThread: EnvironmentThreadShell;
  readonly reportedModelSelection?: ModelSelection | null;
  readonly hasCompactableConversation: boolean;
  /** Set while the next send compacts the thread first. */
  readonly compactBeforeSend?: {
    readonly tokens: number;
    readonly keepFullHistory: boolean;
    readonly toggleKeepFullHistory: () => void;
  } | null;
  /** Arms a fresh session for the next message; absent where `/clear` is unavailable. */
  readonly onFreshSession?: () => void;
  readonly offersSideChat?: boolean;
  readonly serverConfig: T3ServerConfig | null;
  readonly queueCount: number;
  readonly activeThreadBusy: boolean;
  /** Sending declines a pending approval and redirects the agent, so `/side` is plain text. */
  readonly redirectsApproval: boolean;
  readonly canStopThread: boolean;
  readonly environmentId: EnvironmentId;
  readonly projectCwd: string | null;
  readonly sendBlockedReason?: string | null;
  readonly interactionLocked?: boolean;
  readonly draftKey?: string;
  readonly queuedEdit?: {
    readonly existingAttachments: ReadonlyArray<ChatAttachment>;
    readonly saving: boolean;
    readonly onRemoveExistingAttachment: (attachmentId: string) => void;
  } | null;
  readonly followUpBehavior: FollowUpBehavior;
  readonly canSteerActiveTurn: boolean;
  readonly hidden: boolean;
  readonly editorRef?: RefObject<ComposerEditorHandle | null>;
  readonly onChangeDraftMessage: (value: string) => void;
  readonly onPickDraftMedia: () => Promise<void>;
  readonly onPickDraftFiles: () => Promise<void>;
  readonly onNativePasteImages: (uris: ReadonlyArray<string>) => Promise<boolean>;
  readonly onNativePasteText: (paste: ComposerTextPaste) => Promise<void>;
  readonly onRemoveDraftImage: (imageId: string) => void;
  readonly onStopThread: () => void;
  /** Present while the thread's queue is held. */
  readonly onResumeQueue: (() => Promise<void>) | null;
  /** `stillSendable` reports whether the draft is unchanged after any wait before sending. */
  readonly onSendMessage: (
    followUp?: ActiveTurnComposerAction,
    stillSendable?: () => boolean,
  ) => Promise<MessageId | null>;
  readonly onShowUsageLimits: (report: UsageLimitsReport | null) => void;
  readonly canSwitchProvider: boolean;
  readonly onHeightChange?: (height: number) => void;
  readonly onEditorFocusChange?: (focused: boolean) => void;
}

const COMPOSER_ATTACHMENT_ENTERING =
  Platform.OS === "android"
    ? FadeIn.duration(160)
    : FadeIn.delay(COMPOSER_TRANSITION_DURATION_MS).duration(160).reduceMotion(ReduceMotion.System);

const FOLLOW_UP_ACTION_LABEL = {
  queue: msg("Queue", { $context: "verb, send after the current turn" }),
  steer: msg("Steer now"),
  restart: msg("Restart turn"),
} as const;

const FOLLOW_UP_ACTION_SUBTITLE = {
  queue: msg("Run after the current turn"),
  steer: msg("Interrupt what the agent is doing"),
  restart: msg("Start the turn over with this message"),
} as const;

function SendActionButton(props: {
  readonly size?: "regular" | "large";
  readonly accessibilityLabel: string;
  readonly presentation: ComposerSendPresentation;
  readonly disabled: boolean;
  readonly onSend: (followUp?: ActiveTurnComposerAction) => void;
}) {
  const { presentation } = props;
  const gt = useGT();
  const m = useMessages();
  const button = (
    <ComposerActionButton
      accessibilityLabel={props.accessibilityLabel}
      size={props.size}
      icon={presentation.icon}
      variant="primary"
      disabled={props.disabled}
      onPress={() => props.onSend()}
    />
  );
  if (!presentation.offersFollowUpChoice || presentation.action === null || props.disabled) {
    return button;
  }
  const actions = [presentation.action, presentation.alternate].filter(
    (action): action is ActiveTurnComposerAction => action !== null,
  );
  return (
    <Menu
      accessibilityLabel={gt("Choose how to send this message")}
      shouldOpenOnLongPress
      actions={actions.map((action) => ({
        id: action,
        title: m(FOLLOW_UP_ACTION_LABEL[action]),
        subtitle: m(FOLLOW_UP_ACTION_SUBTITLE[action]),
        state: action === presentation.action ? ("on" as const) : ("off" as const),
      }))}
      onPressAction={({ nativeEvent }) =>
        props.onSend(nativeEvent.event as ActiveTurnComposerAction)
      }
    >
      {button}
    </Menu>
  );
}

export const ThreadComposer = function ThreadComposer(props: ThreadComposerProps) {
  const gt = useGT();
  const messages = useMessages();
  const project = useProject(scopeProjectRef(props.environmentId, props.selectedThread.projectId));
  const { themeVariables: materialTheme } = useAppearancePreferences();
  const composerPanel = materialTheme["--color-composer-panel"];
  const navigation = useNavigation();
  const foregroundColor = useUniwindTheme()["--color-foreground"];
  const bodyText = useComposerTextRole();
  const fallbackInputRef = useRef<ComposerEditorHandle>(null);
  const inputRef = props.editorRef ?? fallbackInputRef;
  const [isFocused, setIsFocused] = useState(false);
  const pendingPastedTextAttachmentCountRef = useRef(0);
  const pendingNativeImagePasteCountRef = useRef(0);
  const [pendingPastedTextAttachmentCount, setPendingPastedTextAttachmentCount] = useState(0);
  const settingsRoutePresentedRef = useRef(false);
  const settingsSheetPresentation = useThreadSettingsSheetPresentation({
    editorRef: inputRef,
    onPresent: () => {
      if (settingsRoutePresentedRef.current) return;
      settingsRoutePresentedRef.current = true;
      // The draft composer edits the new-task flow, which owns its own settings route.
      navigation.dispatch(
        props.isDraft
          ? StackActions.push("NewTaskThreadSettings")
          : StackActions.push("ThreadSettingsSheet", {
              environmentId: props.environmentId,
              threadId: props.selectedThread.id,
              draftKey: composerDraftKey,
            } satisfies ExistingThreadSettingsRouteParams),
      );
    },
  });
  const disposeSettingsSheetPresentation = useEffectEvent(settingsSheetPresentation.dispose);
  const wasExpandedBeforePreviewRef = useRef(false);
  const inFlightThreadIdsRef = useRef(new Set<string>());

  const [previewFile, setPreviewFile] = useState<FilePreviewSource | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoPreviewSource | null>(null);
  const composerOwnerKey = scopedThreadKey(props.environmentId, props.selectedThread.id);
  const composerDraftKey = props.draftKey ?? composerOwnerKey;
  const readResetGeneration = useComposerDraftResetGeneration(composerDraftKey);
  const {
    text: draftMessage,
    attachments: draftAttachments,
    context: draftContext,
  } = useComposerDraft(composerDraftKey);
  const queuedEdit = props.queuedEdit ?? null;
  const hasContent =
    draftMessage.trim().length > 0 ||
    draftAttachments.length > 0 ||
    (queuedEdit?.existingAttachments.length ?? 0) > 0;
  const showStopAction = !hasContent && props.canStopThread && queuedEdit === null;
  const onResumeQueue = props.onResumeQueue;
  const [resumingQueue, setResumingQueue] = useState(false);
  const showResumeAction =
    !hasContent && !showStopAction && queuedEdit === null && onResumeQueue !== null;
  const handleResumeQueue = async () => {
    if (resumingQueue || onResumeQueue === null) return;
    setResumingQueue(true);
    await onResumeQueue();
    setResumingQueue(false);
  };

  const operateDenied = useEnvironmentScopeDenied(
    props.environmentId,
    AuthOrchestrationOperateScope,
  );
  const uploadStates = useAtomValue(composerAttachmentUploadsAtom);
  const stripAttachments = composerStripAttachments(
    draftAttachments,
    (attachment) => uploadStates[composerAttachmentUploadKey(props.environmentId, attachment.id)],
  );
  const attachmentsUploading =
    props.connectionState === "connected" &&
    composerAttachmentsStillUploading({
      environmentId: props.environmentId,
      attachments: draftAttachments,
      serverConfig: props.serverConfig,
      states: uploadStates,
    });
  const currentModelSelection = props.selectedThread.modelSelection;
  const modelUnavailable =
    props.connectionState === "connected" &&
    isModelSelectionUnavailable(
      props.serverConfig,
      currentModelSelection,
      props.selectedThread.projectId,
    );
  const selectedProviderStatus = (() => {
    if (!props.serverConfig) return null;
    return (
      props.serverConfig.providers.find(
        (p) => p.instanceId === props.selectedThread.modelSelection.instanceId,
      ) ?? null
    );
  })();
  const openDraftDocument = (attachment: ComposerDocumentAttachment) => {
    Keyboard.dismiss();
    navigation.navigate("ThreadAttachment", {
      environmentId: String(props.environmentId),
      threadId: String(props.selectedThread.id),
      attachmentId: attachment.attachmentId,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: String(attachment.sizeBytes),
      draftKey: composerDraftKey,
    });
  };
  const { onSendMessage, onChangeDraftMessage, onShowUsageLimits } = props;
  const usageLimitsOffered =
    selectedProviderStatus !== null &&
    hasProviderUsageLimits(
      selectedProviderStatus.driver,
      props.serverConfig?.providers ?? [],
      props.serverConfig?.usageLimitSources ?? [],
    );
  const draftRunsLocally = composerRunsDraftLocally({
    text: draftMessage,
    holdsOnlyText: draftAttachments.length === 0,
    // A redirect's text answers its approval, so `/side` there is that text.
    sideChat: !props.redirectsApproval,
    usageLimits: usageLimitsOffered,
    codexFeedback: selectedProviderStatus?.driver === "codex",
    freshSession: props.onFreshSession !== undefined && draftContext === undefined,
  });
  const sendPresentation = resolveComposerSendPresentation(
    {
      editingQueuedMessage: queuedEdit !== null,
      running: props.activeThreadBusy && !draftRunsLocally,
      canSteer: props.canSteerActiveTurn,
      followUpBehavior: props.followUpBehavior,
      deliveryDeferred:
        !draftRunsLocally &&
        (props.connectionState !== "connected" || props.queueCount > 0 || attachmentsUploading),
    },
    messages,
  );
  const sendLabel = sendPresentation.label;
  const openUsageLimits = () => {
    const report = collectProviderUsageLimits(
      currentModelSelection.instanceId,
      props.serverConfig?.providers ?? [],
      props.serverConfig?.usageLimitSources ?? [],
      Date.now(),
      currentModelSelection.model,
    );
    onShowUsageLimits(report);
    if (!report) {
      Dialog.alert(
        gt("Usage limits unavailable"),
        gt("This provider does not currently report limits."),
      );
    }
    return report !== null;
  };

  const mentionableEnvironments = useMentionableEnvironments();
  // Mentions name any model for the agent, so they aren't limited to models this thread can switch to.
  const mentionModelOptions = buildModelOptions(
    props.serverConfig,
    currentModelSelection,
    undefined,
    props.selectedThread.projectId,
  );
  const composerMenu = useComposerCommandMenu({
    draftMessage: draftMessage,
    ownerKey: composerDraftKey,
    environmentId: props.environmentId,
    threadShells: useVisibleThreadShells(),
    environments: offersLinkedEnvironments(props.serverConfig)
      ? mentionableEnvironments
      : NO_MACHINES,
    linkedEnvironments: useLinkedEnvironments(props.environmentId),
    currentThreadId: props.selectedThread.id,
    projectCwd: props.projectCwd,
    pullRequestProjectId: props.serverConfig ? (project?.id ?? null) : null,
    pullRequestRepository: project?.repositoryIdentity?.displayName ?? null,
    threadPullRequests: props.selectedThread.pullRequests,
    selectedProviderStatus,
    hasThread: !props.isDraft,
    hasCompactableConversation: props.hasCompactableConversation,
    onChangeDraftMessage: props.onChangeDraftMessage,
    offersUsageLimits: usageLimitsOffered,
    onUsageLimits:
      usageLimitsOffered && draftAttachments.length === 0 ? openUsageLimits : undefined,
    onOpenModelPicker: settingsSheetPresentation.open,
    modelOptions: mentionModelOptions,
    modelProviders: props.serverConfig?.providers,
    ...(props.onFreshSession === undefined ? {} : { onFreshSession: props.onFreshSession }),
    offersSideChat: props.offersSideChat === true,
  });
  const voiceInput = useVoiceInputController({
    ownerKey: composerDraftKey,
    label: props.selectedThread.title || gt("Untitled thread"),
    readDraftMessage: () => getComposerDraftSnapshot(composerDraftKey).text,
    selection: composerMenu.selection,
    onChangeDraftMessage: (text) => setComposerDraftText(composerDraftKey, text),
    onChangeSelection: composerMenu.onSelectionChange,
  });
  const isSubmissionLocked =
    props.interactionLocked === true || queuedEdit?.saving === true || voiceInput.blocksSubmission;
  const voicePresentation = resolveVoiceComposerPresentation(
    voiceInput.state,
    voiceInput.elapsedSeconds,
    messages,
  );
  const isVoiceInputPresented = voicePresentation.statusKind === "active";
  const isExpanded = isFocused || settingsSheetPresentation.keepsComposerExpanded;
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const { usesLargeControls, paddingVertical } = useComposerChrome();
  const no3yCard = useNo3yBottomNavEnabled();
  const no3yScreenColor = useUniwindTheme()["--color-screen"];
  const surfacePaddingVertical = no3yCard ? NO3Y_CARD_INSET : paddingVertical;
  /* fork:end no3y-mobile-redesign */
  const [compactRowWidth, setCompactRowWidth] = useState(0);
  const compactAttachmentLimit = compactRowWidth >= 500 ? 3 : 1;
  // Animate only while typing; a thread switch or restored draft lands in place.
  const compactEditor = useCompactComposerEditor(
    bodyText,
    draftMessage,
    Platform.OS === "ios" && isFocused,
    /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
    no3yCard
      ? { inset: NO3Y_CARD_INSET, controlsClearance: NO3Y_CARD_CONTROLS_CLEARANCE }
      : undefined,
    /* fork:end no3y-mobile-redesign */
  );
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  // The no3y card keeps the draft text in view while dictating; only its control row swaps.
  const showsCompactDictation = isVoiceInputPresented && !no3yCard;
  const no3yDictating = no3yCard && isVoiceInputPresented;
  /* fork:end no3y-mobile-redesign */
  const isToolbarVisible = isVoiceInputPresented;
  const hasEditingAttachments =
    (queuedEdit !== null && queuedEdit.existingAttachments.length > 0) ||
    stripAttachments.length > 0;
  const attachmentBlockReason = composerAttachmentUploadBlockReason(
    {
      environmentId: props.environmentId,
      attachments: draftAttachments,
      connected: props.connectionState === "connected",
      serverConfig: props.serverConfig,
      states: uploadStates,
    },
    messages,
  );
  const contextImports = useAtomValue(composerContextImportsAtom);
  const sendBlockedReason =
    (queuedEdit?.saving === true ? gt("Saving…") : null) ??
    props.sendBlockedReason ??
    (pendingPastedTextAttachmentCount > 0 ? gt("Attaching pasted text") : null) ??
    attachmentBlockReason;
  const canSend =
    (props.canOperateThread || props.connectionState !== "connected") &&
    hasContent &&
    !contextImports[composerDraftKey] &&
    !isSubmissionLocked &&
    sendBlockedReason === null &&
    !modelUnavailable;

  // A pending sheet presentation or focus restore has no composer left to act on.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- disposes the pending settings sheet presentation and focus restore on unmount
  useEffect(() => () => disposeSettingsSheetPresentation(), []);

  const onPressPreview = (source: FilePreviewSource) => {
    wasExpandedBeforePreviewRef.current = isFocused;
    setPreviewVideo(null);
    setPreviewFile(
      (current) =>
        current ?? {
          ...source,
          gallery: filePreviewGallery(source, composerImageGallery(draftAttachments)),
        },
    );
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewVideo(null);
    if (wasExpandedBeforePreviewRef.current) {
      setTimeout(() => {
        if (navigation.isFocused()) inputRef.current?.focus();
      }, 100);
    }
  };

  const onPressVideo = (attachment: DraftComposerFileAttachment, sourceIdentifier: string) => {
    wasExpandedBeforePreviewRef.current = isFocused;
    setPreviewFile(null);
    setPreviewVideo((current) => current ?? { type: "local", attachment, sourceIdentifier });
  };

  const onEditorFocusChange = props.onEditorFocusChange;
  const handleFocus = () => {
    setIsFocused(true);
    settingsSheetPresentation.onEditorFocusChange(true);
    onEditorFocusChange?.(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    settingsSheetPresentation.onEditorFocusChange(false);
    onEditorFocusChange?.(false);
  };
  const handleSend = async (followUp?: ActiveTurnComposerAction) => {
    if (isSubmissionLocked || sendBlockedReason !== null) return;
    // Sending now would leave a still-converting pasted image out of the turn, so wait for it.
    if (nativeImageSubmit.deferSend(followUp)) return;
    if (pendingPastedTextAttachmentCountRef.current > 0) return;
    if (usageLimitsOffered && isUsageLimitsCommand(draftMessage) && draftAttachments.length === 0) {
      if (openUsageLimits()) onChangeDraftMessage("");
      return;
    }
    const threadKey = scopedThreadKey(props.environmentId, props.selectedThread.id);
    if (inFlightThreadIdsRef.current.has(threadKey)) return;
    inFlightThreadIdsRef.current.add(threadKey);
    await inputRef.current?.flushPendingInput();
    const draftAtSend = getComposerDraftSnapshot(composerDraftKey);
    const stillSendable = () => {
      const draft = getComposerDraftSnapshot(composerDraftKey);
      return (
        pendingPastedTextAttachmentCountRef.current === 0 &&
        pendingNativeImagePasteCountRef.current === 0 &&
        draft.text === draftAtSend.text &&
        draft.attachments.length === draftAtSend.attachments.length &&
        draft.attachments.every(
          (attachment, index) => attachment.id === draftAtSend.attachments[index]?.id,
        )
      );
    };
    const sent = await settlePromise(() => onSendMessage(followUp, stillSendable));
    inFlightThreadIdsRef.current.delete(threadKey);
    if (AsyncResult.isFailure(sent)) {
      console.error("[composer] send failed", squashAtomCommandFailure(sent));
      return;
    }
    if (sent.value === null) return;
    // Arm after send so preference reads and native Activity startup do not delay tap-frame feedback.
    armAgentAwarenessLiveActivityForLocalWork({
      environmentId: props.environmentId,
      threadTitle: props.selectedThread.title,
      projectTitle: props.environmentLabel ?? "T3 Code",
    });
  };

  const nativeImageSubmit = useSubmitAfterNativeImages({
    draftKey: composerDraftKey,
    readResetGeneration,
    blocked: isSubmissionLocked || sendBlockedReason !== null,
    onPasteImages: props.onNativePasteImages,
    onSubmit: (followUp) => void handleSend(followUp),
  });

  const lockedProviderInstanceId = props.canSwitchProvider
    ? undefined
    : currentModelSelection.instanceId;
  const modelOptions = buildModelOptions(
    serverConfigForCwd(props.serverConfig, props.projectCwd),
    currentModelSelection,
    lockedProviderInstanceId,
    props.selectedThread.projectId,
  );
  const currentModelOption =
    modelOptions.find(
      (option) =>
        option.selection.instanceId === currentModelSelection.instanceId &&
        option.selection.model === currentModelSelection.model,
    ) ?? null;
  const openSettings = () => {
    settingsSheetPresentation.open();
  };

  useFocusEffect(() => {
    if (!settingsRoutePresentedRef.current) {
      return;
    }

    settingsRoutePresentedRef.current = false;
    settingsSheetPresentation.onDismissed();
  });

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to the native stack's finishTransitioning event to restore the keyboard after a sheet dismisses
  useEffect(
    () =>
      // The native-stack patch exposes UIKit dismissal completion; restore the keyboard then.
      (navigation as unknown as NavigationWithFinishTransitioning).addListener(
        "finishTransitioning",
        settingsSheetPresentation.onStackTransitionsFinished,
      ),
    [navigation, settingsSheetPresentation.onStackTransitionsFinished],
  );

  // Removable attachments: inside the card, or above the focused one-row composer.
  const editingAttachments = hasEditingAttachments ? (
    <>
      {queuedEdit !== null && queuedEdit.existingAttachments.length > 0 ? (
        <Animated.View
          className="px-[14px] pb-2.5 pt-2"
          entering={COMPOSER_ATTACHMENT_ENTERING}
          exiting={FadeOut.duration(120)}
        >
          <ComposerQueuedEditAttachments
            environmentId={props.environmentId}
            attachments={queuedEdit.existingAttachments}
            disabled={isSubmissionLocked}
            onRemove={queuedEdit.onRemoveExistingAttachment}
          />
        </Animated.View>
      ) : null}
      {stripAttachments.length > 0 ? (
        <Animated.View
          className="px-[14px] pb-2.5 pt-2"
          entering={COMPOSER_ATTACHMENT_ENTERING}
          exiting={FadeOut.duration(120)}
        >
          <ComposerAttachmentStrip
            environmentId={props.environmentId}
            attachments={stripAttachments}
            onRemove={isSubmissionLocked ? () => undefined : props.onRemoveDraftImage}
            onPressPreview={isSubmissionLocked ? undefined : onPressPreview}
            onPressVideo={isSubmissionLocked ? undefined : onPressVideo}
            onPressDocument={
              isSubmissionLocked
                ? undefined
                : (attachment) =>
                    openDraftDocument({
                      attachmentId: attachment.id,
                      name: attachment.name,
                      mimeType: attachment.mimeType,
                      sizeBytes: attachment.sizeBytes,
                    })
            }
          />
        </Animated.View>
      ) : null}
    </>
  ) : null;

  const modelControl = (
    // Only the expanded label can truncate; shrinking the icon-only control clips the icon.
    <View className={compactEditor.isExpanded ? "min-w-0 shrink" : "shrink-0"}>
      <ComposerModelControl
        size={usesLargeControls ? "large" : "regular"}
        modelOption={currentModelOption}
        selection={currentModelSelection}
        provider={selectedProviderStatus?.driver}
        reportedSelection={props.reportedModelSelection}
        prompt={draftMessage}
        surfaceColor={composerPanel}
        iconOnly={!compactEditor.isExpanded}
        onPress={openSettings}
      />
    </View>
  );

  const compactBeforeSend =
    props.compactBeforeSend && !showResumeAction && queuedEdit === null
      ? props.compactBeforeSend
      : null;
  const compactTokens = compactBeforeSend ? formatTokens(compactBeforeSend.tokens) : null;
  const compactControl =
    /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
    // The no3y card offers compaction in its own banner above the composer instead.
    !no3yCard &&
    /* fork:end no3y-mobile-redesign */
    compactBeforeSend &&
    compactTokens !== null ? (
      <ComposerInlineControl
        size={usesLargeControls ? "large" : "regular"}
        icon="arrow.down.right.and.arrow.up.left"
        label={compactTokens}
        selected={!compactBeforeSend.keepFullHistory}
        showChevron={false}
        disabled={!props.canOperateThread}
        accessibilityLabel={
          compactBeforeSend.keepFullHistory
            ? gt("Next send keeps all {tokens} tokens of history", { tokens: compactTokens })
            : gt("Next send compacts {tokens} tokens of history first", { tokens: compactTokens })
        }
        accessibilityHint={
          compactBeforeSend.keepFullHistory ? gt("Compacts first") : gt("Keeps the full history")
        }
        onPress={compactBeforeSend.toggleKeepFullHistory}
      />
    ) : null;

  return (
    <Animated.View
      onLayout={(event) => props.onHeightChange?.(event.nativeEvent.layout.height)}
      className="px-[12px]"
      style={{
        /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
        ...(no3yCard ? { paddingHorizontal: 16 } : null),
        /* fork:end no3y-mobile-redesign */
        paddingTop: 6,
        paddingBottom: (props.bottomInset ?? 0) + THREAD_COMPOSER_BOTTOM_GUTTER,
        backgroundColor:
          Platform.OS === "android" ? themeColorWithAlpha(composerPanel, 1) : undefined,
      }}
    >
      {/* Use a plain View: Reanimated Animated.View drops experimental_backgroundImage on Android. */}
      <View
        className={
          Platform.OS === "android"
            ? "hidden"
            : "absolute inset-0 bg-linear-to-b from-screen/0 via-screen/60 to-screen/90"
        }
        pointerEvents="none"
      />
      {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
      {no3yCard ? <No3yBottomScrim color={no3yScreenColor} /> : null}
      {/* fork:end no3y-mobile-redesign */}
      <Animated.View
        className="relative w-full self-center"
        style={{ maxWidth: props.contentMaxWidth }}
      >
        {props.draftControls}
        {!isSubmissionLocked &&
        composerMenu.trigger &&
        (composerMenu.items.length > 0 || composerMenu.trigger.kind === "pull-request") ? (
          <ComposerPopoverAnchor>
            <ComposerCommandPopover
              items={composerMenu.items}
              triggerKind={composerMenu.trigger.kind}
              isLoading={composerMenu.isLoading}
              error={composerMenu.error}
              onSelect={composerMenu.onSelect}
            />
          </ComposerPopoverAnchor>
        ) : null}

        {selectedProviderStatus?.compatibilityAdvisory?.message &&
        (selectedProviderStatus.compatibilityAdvisory.status === "unsupported" ||
          selectedProviderStatus.compatibilityAdvisory.status === "broken") ? (
          <Text
            accessibilityRole={
              selectedProviderStatus.compatibilityAdvisory.status === "broken" ? "alert" : undefined
            }
            accessibilityLiveRegion={
              selectedProviderStatus.compatibilityAdvisory.status === "broken"
                ? "assertive"
                : "polite"
            }
            className={
              selectedProviderStatus.compatibilityAdvisory.status === "broken"
                ? "bg-danger px-3 py-2 text-xs text-danger-foreground"
                : "px-3 py-2 text-xs text-foreground"
            }
          >
            {selectedProviderStatus.compatibilityAdvisory.message}
          </Text>
        ) : null}
        {modelUnavailable ? (
          <Button
            label={gt("Model unavailable. Open model settings.")}
            tone="text"
            onPress={openSettings}
          />
        ) : null}

        <ComposerSurface
          animateLayout={false}
          /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
          no3yCard={no3yCard ? { runtimeMode: props.selectedThread.runtimeMode } : undefined}
          /* fork:end no3y-mobile-redesign */
          style={{
            /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
            borderRadius: no3yCard ? 32 : usesLargeControls ? 31 : 27,
            /* fork:end no3y-mobile-redesign */
            borderCurve: "circular",
            overflow: "hidden",
            paddingVertical: surfacePaddingVertical,
          }}
        >
          <ComposerDictationError
            error={voiceInput.state.phase === "error" ? voiceInput.state.error : null}
            onDismiss={voiceInput.cancel}
          />
          {isExpanded ? editingAttachments : null}
          {attachmentBlockReason !== null ? (
            <View className="flex-row items-center gap-1.5 px-4 py-1.5">
              <SymbolView
                name="exclamationmark.triangle"
                size={13}
                tintColorClassName="accent-warning-foreground"
                type="monochrome"
              />
              <Text
                accessibilityRole="alert"
                className="min-w-0 flex-1 text-xs text-warning-foreground"
              >
                {attachmentBlockReason}
              </Text>
            </View>
          ) : null}
          <View
            onLayout={(event) => {
              compactEditor.onRowLayout(event);
              setCompactRowWidth(event.nativeEvent.layout.width);
            }}
            /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
            style={no3yCard ? { paddingHorizontal: NO3Y_CARD_INSET } : undefined}
            /* fork:end no3y-mobile-redesign */
          >
            <ComposerDictationDraftContent
              className="flex-row items-end"
              compact
              hidden={showsCompactDictation}
            >
              {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
              {no3yDictating ? null : (
                /* fork:end no3y-mobile-redesign */
                <ComposerAttachmentButton
                  size={usesLargeControls ? "large" : "regular"}
                  disabled={isSubmissionLocked}
                  supportsFiles={props.serverConfig !== null}
                  onPickMedia={props.onPickDraftMedia}
                  onPickFiles={props.onPickDraftFiles}
                  /* fork:begin no3y-prompt-stash — see .fork/customizations.yaml#no3y-prompt-stash */
                  no3yStash={
                    no3yCard && props.draftKey
                      ? { draftKey: props.draftKey, projectTitle: project?.title ?? null }
                      : undefined
                  }
                  /* fork:end no3y-prompt-stash */
                />
                /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
              )}
              {no3yCard && !no3yDictating ? modelControl : null}
              {/* fork:end no3y-mobile-redesign */}
              <Animated.View
                className="min-w-0 flex-1"
                onLayout={compactEditor.onEditorLayout}
                style={[
                  {
                    minWidth:
                      compactEditor.isExpanded ||
                      stripAttachments.length > 0 ||
                      compactControl !== null
                        ? 0
                        : INLINE_EDITOR_MIN_WIDTH,
                  },
                  compactEditor.containerStyle,
                  compactEditor.isExpanded ? { flex: 0, width: 0 } : undefined,
                ]}
              ></Animated.View>
              {/* TalkBack orders siblings by position; outside this row the editor reads after Send. */}
              <Animated.View
                style={[
                  compactEditor.editorStyle,
                  // iOS destroys a view under display: none; the editor would lose its focus and caret.
                  Platform.OS === "android" && showsCompactDictation
                    ? { display: "none" }
                    : undefined,
                ]}
              >
                <ComposerEditor
                  hidden={props.hidden}
                  draftKey={composerDraftKey}
                  environmentId={props.environmentId}
                  onOpenMention={(path) => {
                    Keyboard.dismiss();
                    if (props.isDraft) {
                      navigation.navigate("NewTaskFile", {
                        environmentId: String(props.environmentId),
                        cwd: props.projectCwd ?? undefined,
                        path: fileRoutePathSegments(path),
                      });
                    } else {
                      navigation.navigate("ThreadFile", {
                        environmentId: String(props.environmentId),
                        threadId: String(props.selectedThread.id),
                        path: fileRoutePathSegments(path),
                      });
                    }
                  }}
                  onOpenAttachment={openDraftDocument}
                  chipsInert={!isExpanded}
                  onInertChipPress={() => inputRef.current?.focus()}
                  ref={inputRef}
                  multiline
                  value={draftMessage}
                  // The save uses a draft snapshot; further typing would be discarded on success.
                  readOnly={isSubmissionLocked}
                  skills={composerMenu.skills}
                  selection={composerMenu.selection}
                  onChangeText={(text) => {
                    if (!isSubmissionLocked) props.onChangeDraftMessage(text);
                  }}
                  onSelectionChange={composerMenu.onSelectionChange}
                  onPasteImages={(uris) => {
                    if (isSubmissionLocked) return;
                    pendingNativeImagePasteCountRef.current += 1;
                    void nativeImageSubmit.pasteImages(uris).finally(() => {
                      pendingNativeImagePasteCountRef.current -= 1;
                    });
                  }}
                  onPasteText={(paste) => {
                    if (isSubmissionLocked) return;
                    const insertPaste = () => {
                      const insertion = replaceTextSelection({
                        value: paste.value,
                        selection: paste.selection,
                        text: paste.text,
                      });
                      const selection = { start: insertion.cursor, end: insertion.cursor };
                      props.onChangeDraftMessage(insertion.value);
                      composerMenu.onSelectionChange(selection);
                    };
                    const capabilities = props.serverConfig?.environment.capabilities;
                    const advertisedMax = capabilities?.fileAttachments?.maxUploadBytes;
                    const maxBytes =
                      advertisedMax === undefined
                        ? null
                        : clampFileAttachmentUploadBytes(advertisedMax);
                    const wouldExceedInputLimit =
                      paste.value.length -
                        Math.max(0, paste.selection.end - paste.selection.start) +
                        paste.text.length >
                      PROVIDER_SEND_TURN_MAX_INPUT_CHARS;
                    const canAttach =
                      maxBytes !== null &&
                      countComposerDraftAttachmentsAfterSelection(composerDraftKey, {
                        text: paste.value,
                        ...paste.selection,
                      }) < PROVIDER_SEND_TURN_MAX_ATTACHMENTS &&
                      new TextEncoder().encode(paste.text).byteLength <= maxBytes;
                    if (
                      pastedTextDisposition({
                        text: paste.text,
                        wouldExceedInputLimit,
                        canAttach: true,
                      }) === "attachment"
                    ) {
                      if (canAttach) {
                        pendingPastedTextAttachmentCountRef.current += 1;
                        setPendingPastedTextAttachmentCount(
                          pendingPastedTextAttachmentCountRef.current,
                        );
                        const finishAttachment = () => {
                          pendingPastedTextAttachmentCountRef.current = Math.max(
                            0,
                            pendingPastedTextAttachmentCountRef.current - 1,
                          );
                          setPendingPastedTextAttachmentCount(
                            pendingPastedTextAttachmentCountRef.current,
                          );
                        };
                        void props
                          .onNativePasteText(paste)
                          .then(finishAttachment, finishAttachment);
                      } else if (!wouldExceedInputLimit) {
                        insertPaste();
                      } else {
                        Dialog.alert(
                          gt("Pasted text is too large for this message"),
                          gt("Remove some text or an attachment, then paste again."),
                        );
                      }
                      return;
                    }
                    insertPaste();
                  }}
                  placeholder={props.placeholder}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onSubmit={(alternate) =>
                    void handleSend(
                      alternate && sendPresentation.alternate !== null
                        ? sendPresentation.alternate
                        : undefined,
                    )
                  }
                  submitTitle={sendPresentation.label}
                  alternateSubmitTitle={
                    sendPresentation.alternate === null
                      ? sendPresentation.label
                      : FOLLOW_UP_ACTION_LABEL[sendPresentation.alternate]
                  }
                  {...compactEditor.editorProps}
                  textStyle={{
                    ...bodyText,
                    color: foregroundColor,
                  }}
                />
              </Animated.View>
              {!isExpanded && stripAttachments.length > 0 ? (
                <View className="h-[44px] shrink-0 flex-row items-center gap-1 pl-1">
                  {stripAttachments.slice(0, compactAttachmentLimit).map((attachment) => (
                    <ComposerAttachmentThumbnail
                      environmentId={props.environmentId}
                      key={attachment.id}
                      attachment={attachment}
                      size={30}
                      borderRadius={8}
                      compact
                      onPressPreview={isSubmissionLocked ? undefined : onPressPreview}
                      onPressVideo={isSubmissionLocked ? undefined : onPressVideo}
                    />
                  ))}
                  {stripAttachments.length > compactAttachmentLimit ? (
                    <View className="size-[30px] items-center justify-center rounded-lg bg-subtle-strong">
                      <Text className="text-foreground-muted text-2xs font-t3-bold">
                        +{stripAttachments.length - compactAttachmentLimit}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
              {no3yDictating ? null : (
                /* fork:end no3y-mobile-redesign */
                <View
                  className="min-w-0 shrink flex-row items-center"
                  style={
                    compactEditor.isExpanded ? { flex: 1, justifyContent: "flex-end" } : undefined
                  }
                >
                  <Animated.View
                    key={compactEditor.isExpanded ? "expanded" : "compact"}
                    className="min-w-0 shrink flex-row items-center"
                    entering={compactEditor.toolbarControlsEntering}
                  >
                    {compactControl}
                    {/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */}
                    {no3yCard ? null : modelControl}
                    {/* fork:end no3y-mobile-redesign */}
                  </Animated.View>
                  <ComposerDictationStartAction
                    size={usesLargeControls ? "large" : "regular"}
                    state={voiceInput.state}
                    isAvailable={voiceInput.isAvailable}
                    disabled={isSubmissionLocked}
                    onStart={voiceInput.start}
                    onCancel={voiceInput.cancel}
                  />
                  {showStopAction ? (
                    <ComposerActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={gt("Stop agent")}
                      icon="stop.fill"
                      variant="danger"
                      disabled={!props.canOperateThread}
                      onPress={props.onStopThread}
                    />
                  ) : showResumeAction ? (
                    <ComposerActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={gt("Resume thread")}
                      icon="play"
                      disabled={!props.canOperateThread || resumingQueue}
                      onPress={() => void handleResumeQueue()}
                    />
                  ) : (
                    <SendActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={sendBlockedReason ?? sendLabel}
                      presentation={sendPresentation}
                      disabled={!canSend}
                      onSend={handleSend}
                    />
                  )}
                </View>
                /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
              )}
              {/* fork:end no3y-mobile-redesign */}
            </ComposerDictationDraftContent>
          </View>
          <Animated.View
            accessibilityElementsHidden={!isToolbarVisible}
            collapsable={false}
            importantForAccessibility={isToolbarVisible ? "auto" : "no-hide-descendants"}
            pointerEvents={isToolbarVisible ? "auto" : "none"}
            style={{ position: "absolute", bottom: surfacePaddingVertical, left: 0, right: 0 }}
          >
            <ComposerDictationToolbar
              showsDictation={isVoiceInputPresented}
              visible={isToolbarVisible}
            >
              <ComposerToolbarRow
                paddingBottom={0}
                /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
                /* The card's inset, as its draft row has; flush, stop sat in the rounded corner. */
                paddingHorizontal={no3yCard ? NO3Y_CARD_INSET : 0}
                /* fork:end no3y-mobile-redesign */
                paddingTop={0}
                style={{ gap: 0 }}
              >
                <ComposerDictationCancelAction
                  size={usesLargeControls ? "large" : "regular"}
                  presentation={voicePresentation}
                  onCancel={voiceInput.cancel}
                />
                <ComposerDictationStatus
                  audioLevels={voiceInput.audioLevels}
                  elapsedSeconds={voiceInput.elapsedSeconds}
                  phase={voiceInput.state.phase}
                  presentation={voicePresentation}
                />
                <View className="shrink-0 flex-row items-center">
                  <ComposerDictationPrimaryAction
                    size={usesLargeControls ? "large" : "regular"}
                    state={voiceInput.state}
                    presentation={voicePresentation}
                    isAvailable={voiceInput.isAvailable}
                    disabled={isSubmissionLocked}
                    onStart={voiceInput.start}
                    onConfirm={voiceInput.stop}
                    onCancel={voiceInput.cancel}
                  />
                  {showStopAction ? (
                    <ComposerActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={gt("Stop agent")}
                      icon="stop.fill"
                      variant="danger"
                      disabled={!props.canOperateThread}
                      onPress={props.onStopThread}
                    />
                  ) : showResumeAction && voicePresentation.showsSend ? (
                    <ComposerActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={gt("Resume thread")}
                      icon="play"
                      disabled={!props.canOperateThread || resumingQueue}
                      onPress={() => void handleResumeQueue()}
                    />
                  ) : voicePresentation.showsSend ? (
                    <SendActionButton
                      size={usesLargeControls ? "large" : "regular"}
                      accessibilityLabel={sendBlockedReason ?? sendLabel}
                      presentation={sendPresentation}
                      disabled={!canSend}
                      onSend={handleSend}
                    />
                  ) : null}
                </View>
              </ComposerToolbarRow>
            </ComposerDictationToolbar>
          </Animated.View>
        </ComposerSurface>

        {props.connectionState === "connected" && operateDenied ? (
          <Text className="pt-2 text-xs text-foreground-muted">
            <T>This connection cannot control this task. You can still edit your draft.</T>
          </Text>
        ) : null}
      </Animated.View>

      <VideoPreviewModal source={previewVideo} onRequestClose={closePreview} />
      <FilePreviewModal source={previewFile} onRequestClose={closePreview} />
    </Animated.View>
  );
};
