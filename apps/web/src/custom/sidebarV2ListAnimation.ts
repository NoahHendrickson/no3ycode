/** Sidebar V2 list motion (`.fork/customizations.yaml#sidebar-v2-list-animation`): upstream's
    engine with the fork's fades. Rows grow in from 98% and shrink out to it where they stand,
    and only rows on screen fade, so a group toggle animates however many rows it holds. */
import { createSidebarListMotion, type SidebarListFadeStyle } from "~/components/Sidebar.motion";

/** Where a row stands while it fades, and where it lands. */
const SIDEBAR_V2_LIST_FADE = { shown: "scale(1)", hidden: "scale(.98)" } as const;

type Band = { readonly top: number; readonly bottom: number };

/** The list's visible slice of its scroll viewport, in the list's own coordinates. */
function onScreenBand(list: HTMLElement): Band | null {
  const viewport = list.closest('[data-slot="scroll-area-viewport"]');
  if (viewport === null) return null;
  const listTop = list.getBoundingClientRect().top;
  const { top, bottom } = viewport.getBoundingClientRect();
  return { top: top - listTop, bottom: bottom - listTop };
}

export function createSidebarV2ListMotion(list: HTMLUListElement) {
  let band: Band | null = null;
  const fadeStyle: SidebarListFadeStyle = {
    ...SIDEBAR_V2_LIST_FADE,
    fades: (row) => band === null || (row.top + row.height > band.top && row.top < band.bottom),
    // Fading only what is on screen bounds the clones; the cap would stop a large group's toggle.
    maxFadedRows: Number.POSITIVE_INFINITY,
  };
  const motion = createSidebarListMotion(list, fadeStyle);
  // The rows the engine last measured, so a render that changed none of them skips the reads.
  let measured: readonly Element[] | null = null;
  let releasing = false;
  return {
    update(animate: boolean) {
      const rows = Array.from(list.children);
      const unchanged =
        measured !== null &&
        rows.length === measured.length &&
        rows.every((row, index) => row === measured![index]);
      if (unchanged && !releasing) return;
      releasing = false;
      // A hidden list (the closed mobile sheet) measures every row at 0; the next change starts over.
      if (list.getClientRects().length === 0) {
        motion.suspend();
        measured = rows;
        return;
      }
      band = onScreenBand(list);
      motion.update(animate);
      measured = Array.from(list.children);
    },
    /** Before a drop: rows slide from where the drag left them, transforms included. */
    release() {
      motion.release();
      releasing = true;
    },
    suspend() {
      motion.suspend();
      measured = null;
    },
    dispose: motion.dispose,
  };
}
