/** The sidebar card's docked glyph (fork-split-threads): in the title line's trailing group beside
 * the pin glyph, styled like it, on the thread docked as the column's right pane. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { DockRightIcon } from "../icons/lucide-hugeicons";
import { SIDEBAR_V2_TITLE_GLYPH_CLASS } from "../sidebarV2TrailingColumn";
import { useSplitThreadStore } from "./splitThreadStore";

/** Every sidebar row runs this on each store update, so it compares fields rather than keys. */
export function useThreadDocked(ref: ScopedThreadRef): boolean {
  return useSplitThreadStore((state) => {
    const docked = state.docked?.thread;
    return docked?.threadId === ref.threadId && docked.environmentId === ref.environmentId;
  });
}

export function SidebarDockedMark() {
  return (
    <DockRightIcon
      aria-label="Docked to right"
      role="img"
      weight="fill"
      className={SIDEBAR_V2_TITLE_GLYPH_CLASS}
    />
  );
}
