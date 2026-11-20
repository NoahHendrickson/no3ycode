/**
 * Limit meters toned by share left (success >= 50%, amber >= 20%, red below).
 * Shared by the Usage view and the composer's quota ring / drawer.
 */
import { cn } from "~/lib/utils";

function toneClassName(remaining: number): string {
  if (remaining >= 50) return "text-success";
  if (remaining >= 20) return "text-amber-500 dark:text-yellow-200";
  return "text-destructive";
}

export function UsageMeter(props: {
  readonly remaining: number | null;
  readonly className?: string;
  readonly fillClassName?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden rounded-full bg-muted", props.className)}>
      {props.remaining === null ? null : (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-current transition-[color,opacity]",
            toneClassName(props.remaining),
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
            "stroke-current transition-[stroke-dashoffset,color] duration-200 ease-out motion-reduce:transition-none",
            toneClassName(clamped),
          )}
        />
      ) : null}
    </svg>
  );
}
