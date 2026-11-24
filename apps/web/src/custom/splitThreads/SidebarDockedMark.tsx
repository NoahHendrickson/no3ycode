/** The sidebar card's docked glyph (fork-split-threads): last in the title line's trailing group,
 * after the status mark and the working timer, on the thread docked as the column's right pane. */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

import { DockRightIcon } from "../icons/lucide-hugeicons";
import { useSplitThreadStore } from "./splitThreadStore";

/** Every sidebar row runs this on each store update, so it compares fields rather than keys. */
export function useThreadDocked(ref: ScopedThreadRef): boolean {
  return useSplitThreadStore((state) => {
    const docked = state.docked?.thread;
    return docked?.threadId === ref.threadId && docked.environmentId === ref.environmentId;
  });
}

export function SidebarDockedMark(props: { readonly className?: string }) {
  return (
    <DockRightIcon
      aria-label="Docked to right"
      role="img"
      className={cn("size-3 shrink-0 text-muted-foreground/65", props.className)}
    />
  );
}
