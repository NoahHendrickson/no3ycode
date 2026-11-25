// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-local-dictation`.
 *
 * Pins the fork's dictation controls drawn over upstream's environment speech
 * input: the composer feeds them `speechInput`, the mic, its live check
 * capsule and the send-slot X, and the root-mounted right Command host. The tap itself is
 * guarded in `forkDictationHotkey.test.ts`.
 */
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { cssRules } from "./cssRules";

const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");

describe("fork local dictation", () => {
  it("draws the fork's controls over upstream's speech input, with the root hotkey wired", () => {
    const composer = read("../components/chat/ChatComposer.tsx");
    const control = read("../custom/voice/ForkDictationControl.tsx");
    const dictationModule = read("../custom/voice/forkDictation.ts");
    const hotkeyHost = read("../custom/voice/ForkDictationHotkeyHost.tsx");
    const rootRoute = read("../routes/__root.tsx");
    const preload = read("../../../desktop/src/preload.ts");
    const packaging = read("../../../../scripts/build-desktop-artifact.ts");
    const theme = read("../theme.custom.css");
    // Upstream's speech input owns the session; the fork's controls read it
    // through one adapter, and the composer registers it with the root hotkey.
    expect(composer).toContain("const speechInput = useEnvironmentSpeechInput({");
    expect(composer).toContain("const dictation = forkDictationFromSpeech(speechInput);");
    expect(composer).toContain(
      "useForkDictationHotkeyTarget(dictation, forkDictationStartBlocked, composerFormRef);",
    );
    expect(composer).toMatch(/activePendingIsResponding \|\|\s*speechInput\.freezesEditor\s*\}/u);
    expect(composer).toContain("<ForkDictationNotices dictation={dictation} />");
    // First use opens upstream's setup dialog, rendered beside the slot.
    expect(composer).toMatch(/const composerPrimaryActionSlot = \([\s\S]*?<VoiceInputSetup/u);
    // Upstream's own composer mic and recording pill are not rendered.
    expect(composer).not.toContain("<ComposerSpeechButton");
    expect(composer).not.toContain("<ComposerSpeechRecordingPill");
    expect(composer).toMatch(
      /const forkDictationStartBlocked =[^;]*\(pendingUserInputs\.length > 0 && !dictationAnswersQuestion\)/u,
    );
    expect(composer).toMatch(
      /const dictationAnswersQuestion =[^;]*allowCustomAnswer !== false[^;]*!activePendingIsResponding;/u,
    );
    // Not on a compact viewport: there Next/Submit sit in a strip below the
    // editor with no slot for the session's controls.
    expect(composer).toMatch(
      /const dictationCompactViewport = useMediaQuery\("max-sm"\);\s*const dictationAnswersQuestion =\s*!dictationCompactViewport &&/u,
    );
    // A live session's cancel X takes the send slot. ChatComposer says when it
    // owns the slot: for the whole of a live session, never while idle, so an
    // empty prompt shows send. ComposerPrimaryActions hands the slot over on
    // every path that renders send, including while running, where the X
    // renders before stop so stop keeps the right edge; upstream's send while
    // running (mobile viewports) keeps its place after stop.
    const primary = read("../components/chat/ComposerPrimaryActions.tsx");
    expect(composer).toMatch(
      /const dictationOwnsPrimaryAction = dictation\.isAvailable && dictation\.blocksSubmission;/u,
    );
    // A question keeps Next/Submit until a session starts, then the live
    // session holds the slot like send's. ChatComposer decides that where it
    // hands the slot over; ComposerPrimaryActions' pending branch is upstream's.
    expect(primary).toContain("if (pendingAction) {");
    expect(primary).not.toContain("!forkDictation)");
    expect(composer).toContain(
      "pendingAction={dictationOwnsPrimaryAction ? null : pendingPrimaryAction}",
    );
    expect(composer).toContain(
      "dictationOwnsPrimaryAction ? { dictation, disabled: forkDictationStartBlocked } : null",
    );
    // Since the orchestrator-V2 sync upstream renders stop alone (no send
    // beside it); the fork keeps the mic to stop's left on that branch and
    // otherwise hands the whole slot to the dictation button, bare.
    expect(primary).toMatch(
      /const forkDictationButton = forkDictation \? \(\s*<ForkDictationCancelButton/u,
    );
    expect(primary).toMatch(
      /if \(forkDictation\) \{\s*return \(\s*<>\s*<ForkDictationCancelButton dictation=\{forkDictation\.dictation\} leading \/>\s*\{renderStopGenerationButton\(false\)\}\s*<\/>/u,
    );
    expect(primary).toMatch(
      /if \(forkDictationButton\) \{\s*return withStopButton\(forkDictationButton\);\s*\}/u,
    );
    // Send's look is the fork's normal button on every build: the tone is
    // always "flat", the class list never switches to the transparent
    // stage-art variant, and the Dev/Nightly stage art upstream still renders
    // is hidden by the theme.
    expect(primary).not.toContain('"channel"');
    expect(primary).toMatch(/const sendButtonClassName =\s*"[^"]*bg-message-action[^"]*";/u);
    expect(primary).toContain('data-fork-composer-send-art=""');
    expect(theme).toMatch(/\[data-fork-composer-send-art\]\s*\{\s*display:\s*none;\s*\}/u);
    // Upstream's send doubles as the resume action since the V2 sync.
    expect(primary).toMatch(
      /<button\s+type=\{showResume \? "button" : "submit"\}[^>]*className=\{sendButtonClassName\}/su,
    );
    // A live session swaps the mic for one pure-white capsule: the level
    // meter, then a blue check circle at its right end, where the mic was,
    // so finishing needs no pointer travel. The check spins while transcribing.
    expect(control).toMatch(
      /if \(live\) \{[\s\S]*?data-fork-dictation-live=""[\s\S]*?<VoiceLevelMeter level=\{dictation\.level\} \/>\s*<DictationDoneButton dictation=\{dictation\} \/>/u,
    );
    expect(control).toContain('data-fork-dictation-action="done"');
    expect(control).toMatch(/rounded-full bg-sidebar-v2-status-done text-white/u);
    expect(control).toMatch(/transcribing \? \(\s*<Spinner[^>]*\/>\s*\) : \(\s*<CheckIcon/u);
    expect(control).toContain("onClick={recording ? dictation.stop : undefined}");
    expect(theme).toMatch(
      /\] \[data-fork-dictation-live\]\s*\{\s*color:\s*rgb\(0 0 0 \/ 0\.85\);\s*\}/u,
    );
    expect(theme).toMatch(/\[data-fork-dictation-fill\] \{[^}]*& > \* \{\s*background: white;/u);
    // The capsule takes the mic's pull toward the slot, keeping the check on the mic's spot.
    expect(theme).toMatch(
      /> \[data-fork-dictation-mic\]\[data-fork-dictation-live\]\s*\{\s*margin-inline-end:\s*-6px;/u,
    );
    // Where stop was the only idle action, the X leads the capsule, so a second
    // click where the mic was finishes instead of cancelling.
    expect(theme).toMatch(/\[data-fork-dictation-cancel="leading"\] \{\s*order: -1;/u);
    // The mic sits beside the send button.
    expect(composer).toMatch(
      /const composerPrimaryActionSlot = \([\s\S]{0,1500}?<ForkDictationGhostMic\s*dictation=\{dictation\}\s*disabled=\{forkDictationStartBlocked\}\s*\/>/u,
    );
    expect(control).toMatch(
      /data-fork-composer-action="dictate"\s*disabled=\{disabled\}[\s\S]*?onClick=\{dictation\.start\}/u,
    );
    expect(control).toMatch(/icon=\{<MicIcon weight="fill" \/>\}/u);
    // The X is a ghost in send's box, mounted only while a session is live.
    expect(control).toMatch(
      /export function ForkDictationCancelButton[\s\S]*?<Button[^>]*data-fork-composer-action="dictate-cancel"/su,
    );
    expect(theme).toContain('[data-fork-composer-action="dictate-cancel"]');
    // The meter outlives the session briefly for Inlet's exit animation
    // (useInletMorphPresence). Its bars react in place, each on its own drifting weight, to
    // the current level (dots in silence), never scrolling a history.
    expect(control).toMatch(
      /closing \? \(\s*<VoiceLevelMeter level=\{dictation\.level\} \/>\s*\) : \(/u,
    );
    expect(control).toContain("useInletMorphPresence(live, TIMELINE_CLOSE_MS)");
    expect(control).toContain('data-fork-dictation-meter=""');
    expect(control).toContain("const METER_CENTRE_BIAS");
    // The meter undoes upstream's level easing so bars drop the moment speech
    // stops; its constants must match the worklet's, or the bars misread.
    const worklet = read("../speech/pcmWorklet.ts");
    expect(worklet).toContain("this.levelSamples >= sampleRate / 20");
    expect(worklet).toContain("target > this.level ? 0.075 : 0.2");
    expect(control).toContain("const RISE_DECAY = Math.exp(-1 / 20 / 0.075);");
    expect(control).toContain("const FALL_DECAY = Math.exp(-1 / 20 / 0.2);");
    expect(control).not.toContain("<canvas");
    expect(control).not.toContain("history.push");
    expect(control).not.toContain('"#ffffff"');
    // The registration reads a layout-phase mirror: ChatComposer is memoized,
    // so an effect event would keep the first thread's closure.
    expect(dictationModule).toContain(
      "useLayoutEffect(() => {\n    latest.current = { dictation, disabled, ownsInput };",
    );
    expect(dictationModule).toContain("useOwnsGlobalInput()");
    expect(dictationModule).not.toContain("useEffectEvent");
    expect(rootRoute).toContain("<ForkDictationHotkeyHost />");
    expect(hotkeyHost).toContain("installForkDictationHotkey()");
    // Live words are prompt text in the prompt row, not upstream's box above it,
    // and they hold through transcript cleanup.
    expect(composer).toMatch(
      /<ComposerPromptRow[\s\S]*?<ForkDictationPreview[\s\S]*?<\/ComposerPromptRow>/u,
    );
    expect(composer).not.toContain("{speechInput.preview.committed}");
    expect(composer).toContain("useForkDictationPreview(speechInput)");
    // The scrollport follows the newest words without changing layout mode, so a
    // cancelled session leaves a long draft where it was.
    expect(control).toContain("scroller.scrollTop = scroller.scrollHeight");
    expect(theme).not.toMatch(
      /\[data-fork-composer-prompt\]:has\([^)]*preview[^{]*\{[^}]*column-reverse/u,
    );
    // Solo words replace an empty editor, which stays mounted and focusable.
    expect(theme).toMatch(
      /\[data-fork-dictation-preview="solo"\]\)\s*> :has\(\[data-testid="composer-editor"\]\)\s*\{[^}]*overflow:\s*clip[^}]*opacity:\s*0/u,
    );
    expect(theme).not.toMatch(/padding-left:\s*calc\(24px \+ 6px\)/u);
    // Attach keeps its place in the control row, disabled for the session.
    expect(composer).toContain("const composerAttachAction = showComposerAttachAction ? (");
    expect(composer).toMatch(
      /data-fork-composer-action="attach"[\s\S]{0,200}?disabled=\{dictation\.blocksSubmission\}/u,
    );
    // No tray, slide or stagger, and no separate blue mic. The capsule morphs
    // open leftward out of the check on transforms alone: its fill is two caps
    // and a body, the start cap sliding out while the body stretches, so the
    // round ends never distort and the prompt beside it reflows once, not per
    // frame. Reduced motion fades instead.
    for (const gone of ["data-fork-dictation-tray", "aria-pressed", "trayState"]) {
      expect(control).not.toContain(gone);
    }
    expect(theme).not.toContain("data-fork-dictation-tray");
    expect(theme).not.toMatch(/\[data-fork-composer-action="dictate"\]\[aria-pressed/u);
    expect(theme).not.toContain("dictate-done");
    for (const part of ["fill-start", "fill-body", "fill-end"]) {
      expect(control).toContain(`data-fork-dictation-${part}=""`);
    }
    expect(theme).toMatch(
      /\[data-fork-dictation-fill-start\] \{\s*transition: translate [^;]+;\s*@starting-style \{\s*translate: calc\(100cqw - 32px\) 0;/u,
    );
    expect(theme).toMatch(
      /\[data-fork-dictation-fill-body\] \{\s*transform-origin: right;\s*transition: scale [^;]+;\s*@starting-style \{\s*scale: 0 1;/u,
    );
    expect(theme).not.toMatch(
      /\[data-fork-dictation-live\][^{]*\{[^}]*transition:[^;]*(width|clip-path)/u,
    );
    // When the send slot shows something else (an approval, a choice-only
    // question, the plan follow-up's Implement), or the session's field has
    // left the editor, a live recording settles instead of running with no
    // check on screen, and the keyboard cannot start one there.
    expect(composer).toMatch(
      /if \(dictationLive && !dictationControlsVisible\) settleDictationWithoutControls\(\);/u,
    );
    // Upstream removed plan mode, so no plan follow-up takes the slot any more.
    expect(composer).not.toMatch(/showPlanFollowUpPrompt/u);
    expect(composer).toMatch(
      /const dictationControlsVisible =[^;]*activePendingApproval === null/u,
    );
    // A pending question takes the slot on every viewport (ComposerPrimaryActions
    // returns its pending-action branch before the send slot), so the gate is
    // the pending action itself, not the mobile-only answer strip: a desktop
    // recording must settle when a choice-only question arrives, not run on
    // with no check. The strip's own case rides on dictationAnswersQuestion,
    // which is false on a compact viewport.
    expect(composer).toMatch(
      /const dictationControlsVisible =[^;]*\(pendingUserInputs\.length === 0 \|\| dictationAnswersQuestion\)/u,
    );
    expect(composer).not.toMatch(
      /const dictationControlsVisible =[^;]*showMobilePendingAnswerActions/u,
    );
    expect(composer).toMatch(/const forkDictationStartBlocked =[^;]*promptLockedForProject/u);
    // Fork start gates stay out of upstream's `disabled`, which also cancels a live recording.
    expect(composer).not.toMatch(/const dictationDisabled =[^;]*isSendBusy/u);
    // A live session keeps stop beside its X while a turn runs.
    expect(composer).toContain("hasSendableContent={hasMessageToSend}");
    // The mic follows the editor's gate, not send's: an unassigned new-agent
    // draft (fork-new-agent-draft) blocks send until a project is chosen but
    // keeps the prompt editable, and dictation only writes into the prompt.
    expect(composer).toMatch(/const forkDictationStartBlocked =[^;]*promptLockedForProject/u);
    expect(composer).not.toMatch(/const dictationDisabled =[^;]*projectSelectionRequired/u);
    // A send in flight keeps the spinner in the slot; the ghost mic beside
    // typed text and the keyboard must not start a session over it.
    expect(composer).toMatch(/const forkDictationStartBlocked =[^;]*isSendBusy/u);
    // The notices (the error popover) render beside the slot
    // whatever it shows, so a failed transcription is reported even after typed
    // text has put send back. The buttons render state only.
    expect(control).toContain("export function ForkDictationNotices");
    expect(control).toContain("if (!dictation.isAvailable || !dictation.error) return null");
    expect(control).not.toContain("new VoiceInputController");
    // Microphone hover is "Dictate" on the frosted glass tooltip, a step
    // larger than the default chip. Recording/transcribing keep their labels.
    expect(control).toContain('variant="glass"');
    expect(control).toContain('data-fork-glass-tooltip=""');
    expect(control).toContain('label="Dictate"');
    expect(control).not.toContain("Free and local");
    // The frost itself is the popup recipe every glass tooltip shares
    // (fork-popup-surface); only the sizing is the tooltip's own.
    const frost = cssRules(theme).find(
      (rule) =>
        rule.selector.includes('[data-slot="tooltip-popup"]') &&
        rule.body.includes("backdrop-filter: var(--fork-popup-filter)"),
    );
    expect(frost?.selector).toContain(".dropdown-glass");
    expect(frost?.selector).not.toContain("data-fork-glass-tooltip");
    expect(theme).toMatch(
      /\[data-slot="tooltip-popup"\]\[data-fork-glass-tooltip\]\s*\{[^}]*font-size:\s*13px/u,
    );
    // Toggle is a tap of right Command, not a chord that would steal ⌘C.
    expect(dictationModule).toContain('event.code === "MetaRight"');
    expect(dictationModule).not.toContain('event.code === "Space"');
    expect(control).toContain("Dictate (Right Command)");
    expect(control).not.toContain("Ctrl+Shift+Space");
    // The fork's local whisper.cpp engine is retired: no voice IPC, no helper.
    expect(preload).not.toContain("fork:voice-");
    expect(packaging).not.toContain("voice-input");
    expect(packaging).not.toContain("build-voice-input");
    // Signed builds still claim the microphone for upstream's dictation.
    expect(packaging).toContain("NSMicrophoneUsageDescription");
    expect(packaging).toContain("com.apple.security.device.audio-input");
  });
});
