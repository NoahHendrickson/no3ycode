import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { MicrophoneIcon } from "@phosphor-icons/react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { ForkDictation } from "./forkDictation";

// 1px bars on a 4px pitch, 3px in from either edge, up to 12px tall in the 20px
// control row, painted in the canvas's own `color` (theme.custom.css).
const BAR_WIDTH = 1;
const BAR_PITCH = 4;
const BAR_GAP = BAR_PITCH - BAR_WIDTH;
const DOT_HEIGHT = 2;
const BAR_MAX_HEIGHT = 12;
const BAR_INSET = 3;
// Samples arrive at 20 Hz; 30 s of history at 4px each outruns any composer.
const HISTORY_LIMIT = 600;
// Quiet speech sits around -40 dBFS and normal speech near -20, so map the
// -50…-10 dB range to the bar height instead of raw amplitude, which barely
// moves for anything below a raised voice.
const FLOOR_DB = -50;
const CEILING_DB = -10;

function levelToUnit(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB)));
}

/**
 * Input-level timeline: one dot per sample, newest at the right edge, so
 * silence is a row of dots and speech is bars scrolling left. Mounted only
 * while a session is live, so each session starts empty.
 *
 * Painted on a canvas rather than as DOM bars: the row can be hundreds of
 * samples wide and every sample moves all of them, so one clear-and-fill per
 * sample beats hundreds of style writes. No CSS transition, since a new value
 * every 50 ms would never settle. The bitmap follows the element's box, so a
 * window resize repaints it at the new width.
 */
function VoiceLevelTimeline(props: { level: number }) {
  const { level } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);
  const paintRef = useRef<() => void>(() => {});
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- owns the canvas bitmap and repaints it when the element resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const history = historyRef.current;
    const paint = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const scale = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(canvas).color;
      const slots = Math.floor((width - 2 * BAR_INSET + BAR_GAP) / BAR_PITCH);
      for (let slot = 0; slot < slots; slot++) {
        const sample = history[history.length - slots + slot];
        const barHeight =
          sample === undefined
            ? DOT_HEIGHT
            : DOT_HEIGHT + Math.round(sample * (BAR_MAX_HEIGHT - DOT_HEIGHT));
        const x = width - BAR_INSET + BAR_GAP - (slots - slot) * BAR_PITCH;
        context.fillRect(x, (height - barHeight) / 2, BAR_WIDTH, barHeight);
      }
    };
    paintRef.current = paint;
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();
    return () => {
      paintRef.current = () => {};
      observer.disconnect();
    };
  }, []);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- appends each meter sample to the canvas history and repaints the bitmap
  useEffect(() => {
    const history = historyRef.current;
    // Upstream meters min(1, 4 × RMS); undo the gain so the bars keep their dB scale.
    history.push(levelToUnit(level / 4));
    if (history.length > HISTORY_LIMIT) history.shift();
    paintRef.current();
  }, [level]);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-fork-dictation-timeline=""
      className="block h-5 w-16 shrink-0 text-foreground"
    />
  );
}

/**
 * The words heard so far, drawn as prompt text after the draft they will join.
 * theme.custom.css lets `solo` stand in for an empty editor.
 */
export function ForkDictationPreview(props: {
  preview: { readonly committed: string; readonly tentative: string };
  promptEmpty: boolean;
}) {
  return (
    <div
      aria-label="Live transcription"
      data-fork-dictation-preview={props.promptEmpty ? "solo" : "after-draft"}
      className="font-(family-name:--font-composer,var(--font-sans)) text-(length:--font-size-prompt,var(--text-sm)) leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground max-sm:pointer-coarse:text-(length:--font-size-prompt-touch)"
    >
      <span>{props.preview.committed}</span>
      <span className="text-muted-foreground">{props.preview.tentative}</span>
    </div>
  );
}

const DONE_LABEL = "Done, transcribe (Right Command)";

/** What ComposerPrimaryActions needs to hand the send slot to dictation. */
export type ForkDictationPrimary = {
  readonly dictation: ForkDictation;
  readonly disabled: boolean;
};

/**
 * The mic's hover: the word Dictate on the frosted glass tooltip, a step
 * larger than the default chip. A live session shows its action label instead.
 */
function DictationTooltip(props: { label: string; trigger: ReactElement; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={props.trigger}>{props.icon}</TooltipTrigger>
      <TooltipPopup variant="glass" data-fork-glass-tooltip="">
        {props.label}
      </TooltipPopup>
    </Tooltip>
  );
}

/**
 * The mic: a ghost in the composer's control row, beside attach and ahead of
 * the mode controls, with the level timeline beside it for a live session.
 * Starting a session hands the send slot to ForkDictationPrimaryButton; while
 * recording, a click finishes it, as the check does.
 */
export function ForkDictationGhostMic(props: { dictation: ForkDictation; disabled: boolean }) {
  const { dictation, disabled } = props;
  if (!dictation.isAvailable) return null;
  const recording = dictation.state.phase === "recording";
  return (
    <div
      {...(dictation.blocksSubmission ? { "data-fork-dictation-live": "" } : {})}
      className="flex shrink-0 items-center"
    >
      <DictationTooltip
        label={recording ? DONE_LABEL : "Dictate"}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={recording ? DONE_LABEL : "Dictate (Right Command)"}
            data-fork-composer-action="dictate"
            disabled={disabled && !recording}
            onPointerDown={(event) => event.preventDefault()}
            onClick={recording ? dictation.stop : dictation.start}
          />
        }
        icon={<MicrophoneIcon weight="fill" />}
      />
      {dictation.blocksSubmission ? <VoiceLevelTimeline level={dictation.level} /> : null}
    </div>
  );
}

/**
 * A live session borrows the send button: it becomes the check, with a cancel
 * X beside it, and the check spins while transcribing.
 * Everything appears in place: nothing slides, grows, or springs in.
 *
 * `className` is the send button's own, passed in by ComposerPrimaryActions so
 * the check is the send button in every respect but its glyph and click. Pointer-down is always swallowed so the editor keeps focus and the
 * transcript lands at its caret.
 */
export function ForkDictationPrimaryButton(props: {
  dictation: ForkDictation;
  disabled: boolean;
  className: string;
}) {
  const { dictation, disabled, className } = props;
  const { phase } = dictation.state;
  const recording = phase === "recording";
  // Cleanup by a text model (upstream's post-processing) spins like transcription.
  const transcribing = phase === "transcribing" || phase === "post-processing";
  const busy = dictation.blocksSubmission;
  const label = transcribing
    ? "Transcribing (Escape to cancel)"
    : busy
      ? DONE_LABEL
      : "Dictate (Right Command)";
  return (
    <>
      {busy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Cancel dictation (Escape)"
          // Shares attach's 24px box and hover from theme.custom.css.
          data-fork-composer-action="dictate-cancel"
          onPointerDown={(event) => event.preventDefault()}
          onClick={dictation.cancel}
        >
          <XIcon />
        </Button>
      ) : null}
      <DictationTooltip
        label={busy ? label : "Dictate"}
        trigger={
          <button
            type="button"
            // Keeps the send button's fork styling while the second attribute
            // names what it does now.
            data-fork-composer-action="send"
            data-fork-composer-send-tone="flat"
            data-fork-dictation-action={busy ? "done" : "dictate"}
            // Transcribing is inert but not dimmed; the check spins instead.
            className={cn(className, transcribing && "pointer-events-none")}
            aria-label={label}
            aria-busy={transcribing || undefined}
            // Preparing has nothing to confirm yet; the X is the way out.
            disabled={phase === "preparing" || (!busy && disabled)}
            onPointerDown={(event) => event.preventDefault()}
            onClick={recording ? dictation.stop : transcribing ? undefined : dictation.start}
          />
        }
        icon={
          transcribing ? (
            <Spinner className="size-3.5" aria-hidden />
          ) : busy ? (
            <CheckIcon className="size-4" aria-hidden />
          ) : (
            <MicrophoneIcon weight="fill" className="size-4" aria-hidden />
          )
        }
      />
    </>
  );
}

/**
 * A failed session's message and its actions, beside the primary actions
 * whatever the send slot shows: typed text may have put send back already.
 * Model setup and downloads are upstream's first-run dialog.
 */
export function ForkDictationNotices(props: { dictation: ForkDictation }) {
  const { dictation } = props;
  const navigate = useNavigate();
  if (!dictation.isAvailable || !dictation.error) return null;
  return (
    <div className="relative flex shrink-0 items-center">
      <div
        role="alert"
        className="absolute bottom-full right-0 z-20 mb-2 w-64 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md"
      >
        {dictation.error}
        <div className="mt-2 flex justify-end gap-1">
          {dictation.errorAction === "settings" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void navigate({ to: "/settings/voice" })}
            >
              Open voice settings
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={dictation.cancel}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
