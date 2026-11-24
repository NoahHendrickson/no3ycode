import { ComposerControl } from "~/components/chat/ComposerControl";

import { ListNumberIcon } from "./icons/lucide-hugeicons";

/** The collapsed queue card, as a pill in the composer's chip row; clicking it opens the card. */
export function ComposerQueuedChip(props: {
  readonly count: number;
  readonly onExpand: () => void;
}) {
  return (
    <ComposerControl
      size="xs"
      data-fork-composer-status-chip="queued"
      aria-label={`Show ${props.count} queued message${props.count === 1 ? "" : "s"}`}
      onClick={props.onExpand}
    >
      <ListNumberIcon aria-hidden />
      <span aria-hidden>
        Queued
        <span className="text-muted-foreground tabular-nums">{` ${props.count}`}</span>
      </span>
    </ComposerControl>
  );
}
