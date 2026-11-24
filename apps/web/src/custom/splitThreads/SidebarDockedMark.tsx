/** The sidebar card's docked glyph (fork-split-threads): in the title line's trailing group beside
 * the pin glyph, styled like it, on the thread docked as the column's right pane. */
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
      weight="fill"
      className={cn("size-3 shrink-0 text-foreground dark:text-white", props.className)}
    />
  );
}
