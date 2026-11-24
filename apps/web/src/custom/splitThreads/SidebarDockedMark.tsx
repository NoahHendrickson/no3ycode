/** The sidebar card's docked glyph (fork-split-threads): last in the title line's trailing group,
 * after the status mark and the working timer, on the thread docked as the column's right pane. */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";

import { cn } from "~/lib/utils";

import { DockRightIcon } from "../icons/lucide-hugeicons";
import { useSplitThreadStore } from "./splitThreadStore";

export function useThreadDocked(threadKey: string): boolean {
  return useSplitThreadStore(
    (state) => state.docked !== null && scopedThreadKey(state.docked) === threadKey,
  );
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
