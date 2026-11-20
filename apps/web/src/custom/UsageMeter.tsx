/**
 * A limit meter: a muted, fully rounded track filled to the share left, toned
 * green from 50%, amber down to 20%, red below. Shared by the Usage
 * limits view and the composer's limits bar (fork-usage-limits-surface,
 * fork-composer-usage-limits). Size the track with `className`; `remaining`
 * null draws the bare track for an account with no window.
 */
import { cn } from "~/lib/utils";

function toneOf(remaining: number): string {
  if (remaining >= 50) return "bg-[#38a169]";
  if (remaining >= 20) return "bg-amber-500 dark:bg-yellow-200";
  return "bg-destructive";
}

function strokeToneOf(remaining: number): string {
  if (remaining >= 50) return "stroke-[#38a169]";
  if (remaining >= 20) return "stroke-amber-500 dark:stroke-yellow-200";
  return "stroke-destructive";
}

export function UsageMeter(props: {
  readonly remaining: number | null;
  readonly className?: string;
  readonly fillClassName?: string;
  readonly radiusClassName?: string;
}) {
  const radius = props.radiusClassName ?? "rounded-full";
  return (
    <span className={cn("relative block overflow-hidden bg-muted", radius, props.className)}>
      {props.remaining === null ? null : (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 transition-[background-color,opacity]",
            radius,
            toneOf(props.remaining),
            props.fillClassName,
          )}
          style={{ width: `${props.remaining}%` }}
        />
      )}
    </span>
  );
}

/** Circular ring variant of UsageMeter for the composer's compact quota trigger. */
export function UsageCircleMeter(props: {
  readonly remaining: number | null;
  readonly className?: string;
}) {
  const clamped = props.remaining === null ? null : Math.max(0, Math.min(100, props.remaining));
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={cn("size-4 shrink-0 -rotate-90", props.className)}
    >
      <circle cx="8" cy="8" r="6.25" fill="none" strokeWidth="2.5" className="stroke-current/25" />
      {clamped !== null && clamped > 0 ? (
        <circle
          cx="8"
          cy="8"
          r="6.25"
          fill="none"
          strokeWidth="2.5"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - clamped}
          strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-200 ease-out motion-reduce:transition-none",
            strokeToneOf(clamped),
          )}
        />
      ) : null}
    </svg>
  );
}
