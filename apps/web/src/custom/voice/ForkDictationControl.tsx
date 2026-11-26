import { useEffect, useLayoutEffect, useRef, type ReactElement, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckIcon, MicIcon, XIcon } from "../icons/lucide-hugeicons";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { ForkDictation } from "./forkDictation";

const METER_BARS = 11;
// A silent bar is a 3px dot in the meter's 20px height.
const METER_REST_SCALE = 3 / 20;
// A lean toward the middle (edges keep about half); each bar's own drifting
// weight shapes it too, so it never settles into one hill.
const METER_CENTRE_BIAS = Array.from({ length: METER_BARS }, (_, index) => {
  const distance = Math.abs(index - (METER_BARS - 1) / 2) / ((METER_BARS - 1) / 2);
  return 1 - 0.55 * distance * distance;
});
const METER_BAR_IDS = METER_CENTRE_BIAS.map((_, index) => String(index));
const METER_WEIGHT_MIN = 0.35;
// Quiet or background speech sits around -40…-50 dBFS and normal speech near -20, so map
// -56…-20 dB to the bar height (normal speech tops the centre bar) instead of
// raw amplitude, which barely moves for anything below a raised voice.
const FLOOR_DB = -56;
const CEILING_DB = -20;
// Below 1 lifts the middle of the range, so a slightly louder word shows.
const METER_GAMMA = 0.8;

// Upstream's worklet (speech/pcmWorklet.ts) eases its 20 Hz level, 75 ms up and
// 200 ms down; that release held the bars up ~0.6 s after speech stopped. The
// ease is a fixed per-sample blend, so two readings recover the raw level.
const RISE_DECAY = Math.exp(-1 / 20 / 0.075);
const FALL_DECAY = Math.exp(-1 / 20 / 0.2);

function unsmoothLevel(level: number, previous: number): number {
  const decay = level > previous ? RISE_DECAY : FALL_DECAY;
  return Math.min(1, Math.max(0, (level - previous * decay) / (1 - decay)));
}

function levelToUnit(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / (CEILING_DB - FLOOR_DB))) ** METER_GAMMA;
}

/**
 * Bars that react in place to the current level, never scrolling. Each bar
 * wanders its own weight and rises and falls on its own, so speech reads as an
 * uneven voice rather than one shape. Repaints only on upstream's 20 Hz levels.
 */
function VoiceLevelMeter(props: { level: number }) {
  const { level } = props;
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const weightsRef = useRef<number[]>([]);
  const heightsRef = useRef<number[]>([]);
  // Seeded with the level at mount, so a meter mounting mid-session doesn't spike.
  const lastLevelRef = useRef(level);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- writes each meter sample to the bars' native transforms
  useEffect(() => {
    const weights = weightsRef.current;
    const heights = heightsRef.current;
    // Capture shutdown sends a bare 0 and then nothing more; rest every bar on it.
    const resting = level === 0;
    const raw = unsmoothLevel(level, lastLevelRef.current);
    lastLevelRef.current = level;
    // Upstream meters min(1, 4 × RMS); undo the gain so the bars keep their dB scale.
    const unit = levelToUnit(raw / 4);
    barsRef.current.forEach((bar, index) => {
      const drifted = (weights[index] ?? Math.random()) + (Math.random() - 0.5) * 0.3;
      const weight = Math.min(1, Math.max(METER_WEIGHT_MIN, drifted));
      weights[index] = weight;
      const target = unit * weight * (METER_CENTRE_BIAS[index] ?? 1);
      const previous = heights[index] ?? 0;
      const height = resting || target >= previous ? target : previous * 0.2 + target * 0.8;
      heights[index] = height;
      if (bar) {
        bar.style.transform = `scaleY(${METER_REST_SCALE + (1 - METER_REST_SCALE) * height})`;
      }
    });
  }, [level]);
  return (
    <div
      aria-hidden
      data-fork-dictation-meter=""
      className="flex h-5 shrink-0 items-center gap-0.75"
    >
      {METER_BAR_IDS.map((id, index) => (
        <span
          key={id}
          ref={(bar) => {
            barsRef.current[index] = bar;
          }}
          className="h-full w-0.5 rounded-full bg-current transition-transform duration-75 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleY(${METER_REST_SCALE})` }}
        />
      ))}
    </div>
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
  const { committed, tentative } = props.preview;
  const ref = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the prompt's DOM scroller on the newest words
  useLayoutEffect(() => {
    const scroller = ref.current?.parentElement;
    if (!scroller || (!committed && !tentative)) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [committed, tentative]);
  return (
    <div
      ref={ref}
      aria-label="Live transcription"
      data-fork-dictation-preview={props.promptEmpty ? "solo" : ""}
      className="font-(family-name:--font-composer,var(--font-sans)) text-(length:--font-size-prompt,var(--text-base)) leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground max-sm:pointer-coarse:text-(length:--font-size-prompt-touch)"
    >
      <span>{committed}</span>
      <span className="text-muted-foreground">{tentative}</span>
    </div>
  );
}

const DONE_LABEL = "Done, transcribe (Right Command)";

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
 * The blue check (the done status colour) that ends a session, at the pill's right end so it lands
 * under the mic that started it. It spins while transcribing or cleaning up.
 */
function DictationDoneButton(props: { dictation: ForkDictation }) {
  const { dictation } = props;
  const { phase } = dictation.state;
  const recording = phase === "recording";
  // Cleanup by a text model (upstream's post-processing) spins like transcription.
  const transcribing = phase === "transcribing" || phase === "post-processing";
  const label = transcribing ? "Transcribing (Escape to cancel)" : DONE_LABEL;
  return (
    <DictationTooltip
      label={label}
      trigger={
        <button
          type="button"
          data-fork-dictation-action="done"
          // Transcribing is inert but not dimmed; the check spins instead.
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-v2-status-done text-white enabled:cursor-pointer enabled:hover:brightness-110 disabled:opacity-64 [&_svg]:pointer-events-none",
            transcribing && "pointer-events-none",
          )}
          aria-label={label}
          aria-busy={transcribing || undefined}
          // Preparing has nothing to confirm yet; the X is the way out.
          disabled={phase === "preparing"}
          onPointerDown={(event) => event.preventDefault()}
          onClick={recording ? dictation.stop : undefined}
        />
      }
      icon={
        transcribing ? (
          <Spinner className="size-3.5" aria-hidden />
        ) : (
          <CheckIcon className="size-3.5" strokeWidth={2.6} aria-hidden />
        )
      }
    />
  );
}

/**
 * The mic, beside the send slot. A live session swaps it for the white capsule,
 * its check exactly where the mic was so finishing needs no pointer travel.
 * Pointer-down is swallowed so the transcript lands at the editor's caret.
 */
export function ForkDictationGhostMic(props: { dictation: ForkDictation; disabled: boolean }) {
  const { dictation, disabled } = props;
  const live = dictation.blocksSubmission;
  if (!dictation.isAvailable) return null;
  if (live) {
    return (
      <div
        // A fresh element, not the idle mic's div reused: its grow is @starting-style.
        key="live"
        data-fork-dictation-live=""
        data-fork-dictation-mic=""
        className="relative isolate flex h-8 shrink-0 items-center gap-1.5 p-0.5 ps-2.5"
      >
        {/* The white fill as two caps and a body, so it can grow out of the
            check on transforms alone without stretching its round ends. */}
        <span
          aria-hidden
          data-fork-dictation-fill=""
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <span data-fork-dictation-fill-start="" className="absolute inset-y-0 left-0 w-8" />
          <span data-fork-dictation-fill-body="" className="absolute inset-y-0 inset-x-4" />
          <span data-fork-dictation-fill-end="" className="absolute inset-y-0 right-0 w-8" />
        </span>
        <VoiceLevelMeter level={dictation.level} />
        <DictationDoneButton dictation={dictation} />
      </div>
    );
  }
  return (
    <div data-fork-dictation-mic="" className="flex shrink-0 items-center">
      <DictationTooltip
        label="Dictate"
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dictate (Right Command)"
            data-fork-composer-action="dictate"
            disabled={disabled}
            onPointerDown={(event) => event.preventDefault()}
            onClick={dictation.start}
          />
        }
        icon={<MicIcon weight="fill" />}
      />
    </div>
  );
}

/**
 * A live session's cancel X, a ghost in the send button's box, so the
 * capsule beside it keeps its check where the mic was.
 */
export function ForkDictationCancelButton(props: { dictation: ForkDictation; leading?: boolean }) {
  return (
    <Button
      // Beside stop alone, theme.custom.css moves the X to the capsule's left.
      {...(props.leading ? { "data-fork-dictation-cancel": "leading" } : {})}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Cancel dictation (Escape)"
      // Shares attach's box and hover from theme.custom.css.
      data-fork-composer-action="dictate-cancel"
      onPointerDown={(event) => event.preventDefault()}
      onClick={props.dictation.cancel}
    >
      <XIcon />
    </Button>
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
