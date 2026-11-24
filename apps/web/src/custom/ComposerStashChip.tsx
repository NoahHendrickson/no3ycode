import { useGT } from "gt-react";
import { BookmarkIcon } from "lucide-react";
import { memo } from "react";

import { ComposerControl } from "~/components/chat/ComposerControl";
import { cn } from "~/lib/utils";

/** The collapsed stash card, as a pill in the composer's chip row like the queue's; a click opens the card. */
export const ComposerStashChip = memo(function ComposerStashChip(props: {
  count: number;
  /** Bumped per stash; each new key replays the pulse. 0 means never pulsed. */
  pulseKey: number;
  onOpen: () => void;
}) {
  const gt = useGT();
  if (props.count === 0) return null;
  const pulsed = props.pulseKey > 0;
  return (
    <ComposerControl
      size="xs"
      data-fork-composer-status-chip="stash"
      aria-label={gt("Stashed prompts: {count}. Open stash.", { count: props.count })}
      onPointerDown={(event) => event.preventDefault()}
      onClick={props.onOpen}
    >
      <BookmarkIcon aria-hidden />
      <span aria-hidden>
        {gt("Stash", { $context: "noun, saved prompts set aside for later" })}{" "}
        <span
          // Remounting the count per stash restarts its CSS pulse; no timer has to end it.
          key={props.pulseKey}
          className={cn(
            "inline-block text-muted-foreground tabular-nums",
            pulsed &&
              "animate-stash-pulse-count transition-[opacity,translate] duration-180 ease-out starting:translate-y-0.5 starting:opacity-0 motion-reduce:transition-none",
          )}
        >
          {props.count}
        </span>
      </span>
    </ComposerControl>
  );
});
