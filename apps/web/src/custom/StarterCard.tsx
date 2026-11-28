/** An empty thread's ways to start, one card of icon rows split by hairlines. A split agent's draft
 * (fork-split-threads) and an empty sprint (fork-sprints) both show it. */
import type { LucideIcon } from "./icons/lucide-hugeicons";

export interface Starter {
  readonly key: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly prompt: string;
}

export function StarterCard(props: {
  readonly starters: readonly Starter[];
  readonly onPick: (prompt: string) => void;
}) {
  return (
    <div
      data-fork-starter-card=""
      className="pointer-events-auto flex w-full max-w-sm flex-col divide-y divide-border overflow-hidden rounded-(--fork-composer-radius) border border-border bg-card"
    >
      {props.starters.map(({ key, label, Icon, prompt }) => (
        <button
          key={key}
          type="button"
          className="flex h-11 w-full min-w-0 cursor-pointer select-none items-center gap-2.5 px-3.5 text-left text-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
          onClick={() => props.onPick(prompt)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}
