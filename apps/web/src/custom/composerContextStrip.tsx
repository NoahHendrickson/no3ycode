import type { ReactNode } from "react";

import { ComposerSurface } from "~/components/chat/ComposerSurface";

/** The read-only chip look in the context row: a locked BranchToolbar
 * readout and ThreadContextReadout share it. Layout (width, flex) stays at
 * each call site. */
export const READ_ONLY_CONTEXT_CHIP_CLASS_NAME =
  "inline-flex h-7 min-w-0 items-center gap-1 border border-transparent px-1.75 font-normal text-muted-foreground/70 text-xs sm:h-6";

/** The leading draft project chip and trailing background-work toggle, for when BranchToolbar
 * paints no visible strip (non-repo, a draft with no project yet, an unresolved thread shell).
 * They mount in upstream's ContextStrip chrome so they sit where the toolbar's chips would. */
export function renderComposerContextStripFallback({
  leading,
  trailing,
}: {
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
}): ReactNode {
  if (!leading && !trailing) {
    return null;
  }
  return (
    <ComposerSurface.ContextStrip>
      {leading ?? null}
      {trailing ?? null}
    </ComposerSurface.ContextStrip>
  );
}
