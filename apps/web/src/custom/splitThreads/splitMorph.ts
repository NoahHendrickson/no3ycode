/**
 * Pairing and unpairing morph — see `.fork/customizations.yaml#fork-split-threads`.
 * Names live only for the transition: a named element gets its own surface,
 * which breaks backdrop-filter on Glass.
 */
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { flushSync } from "react-dom";

import { findSplitPair } from "./splitThreadPairs";
import { useSplitThreadStore } from "./splitThreadStore";

const MORPH_ATTRIBUTE = "data-fork-split-morph";
const ITEM_ATTRIBUTE = "data-fork-split-item";
const PAIR_SELECTOR = "[data-fork-split-pair], [data-fork-split-tab-group]";
// The sidebar list's rows and the tab strip's tabs, outside any pair.
const ROW_SELECTOR = "[data-fork-thread-list] li, [data-fork-thread-tabs] nav > *";

const onScreen = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
};

const nameAs = (
  element: HTMLElement,
  name: string,
  kind: "fork-split-morph" | "fork-split-row",
) => {
  element.style.viewTransitionName = name;
  element.style.setProperty("view-transition-class", kind);
};

const unname = (element: HTMLElement) => {
  element.style.viewTransitionName = "";
  element.style.removeProperty("view-transition-class");
};

/** Names the rows on screen that the update keeps: React reuses their nodes, so they
    slide. The involved items and pair rows are named by key instead. */
function nameRows(keys: readonly string[]): HTMLElement[] {
  const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)].filter(
    (row) =>
      !keys.includes(row.getAttribute(ITEM_ATTRIBUTE) ?? "") &&
      !row.matches(PAIR_SELECTOR) &&
      !row.parentElement?.closest(PAIR_SELECTOR) &&
      onScreen(row),
  );
  rows.forEach((row, index) => nameAs(row, `fork-split-row-${index}`, "fork-split-row"));
  return rows;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { readonly finished: Promise<void> };
};

// The longest the morph holds the page for a route change: no frame paints until it ends.
const ROUTE_WAIT_MS = 200;

/** While true, other list motion stands down so the morph captures the settled layout. */
export const isSplitMorphing = () => document.documentElement.hasAttribute(MORPH_ATTRIBUTE);

/** Names each involved, visible item and the pair rows holding them; returns the named. */
function nameInvolved(keys: readonly string[]): HTMLElement[] {
  const named: HTMLElement[] = [];
  const seen = new Set<string>();
  for (const element of document.querySelectorAll<HTMLElement>(`[${ITEM_ATTRIBUTE}]`)) {
    const index = keys.indexOf(element.getAttribute(ITEM_ATTRIBUTE) ?? "");
    // One name per key: the sidebar and the tab strip both carry it, but only one shows.
    if (index < 0 || seen.has(keys[index]!) || !onScreen(element)) continue;
    seen.add(keys[index]!);
    nameAs(element, `fork-split-item-${index}`, "fork-split-morph");
    named.push(element);
    const pairRow = element.closest<HTMLElement>(PAIR_SELECTOR);
    if (pairRow && !named.includes(pairRow)) {
      // A pair row is named for its members, so the old and new pairs differ.
      const members = [...pairRow.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)]
        .map((member) => keys.indexOf(member.getAttribute(ITEM_ATTRIBUTE) ?? ""))
        .join("-");
      nameAs(pairRow, `fork-split-pair-${members}`, "fork-split-morph");
      named.push(pairRow);
    }
  }
  return named;
}

/** Runs `update` (a pair or unpair of `refs`) inside the morph, or directly where
    view transitions are unavailable. A promise it returns (a route change) joins the end
    state if it settles quickly. */
export function morphSplitPairs(
  refs: readonly ScopedThreadRef[],
  update: () => Promise<unknown> | void,
): void {
  const transitionDocument = document as TransitionDocument;
  if (!transitionDocument.startViewTransition) {
    void update();
    return;
  }
  // The refs and their partners now: a thread paired elsewhere leaves that pair.
  const { pairs } = useSplitThreadStore.getState();
  const keys = [
    ...new Set(
      refs
        .flatMap((ref) => {
          const pair = findSplitPair(pairs, ref);
          return pair ? [ref, pair.a, pair.b] : [ref];
        })
        .map((ref) => scopedThreadKey(ref)),
    ),
  ];
  const root = document.documentElement;
  let named = nameInvolved(keys);
  const rows = nameRows(keys);
  root.setAttribute(MORPH_ATTRIBUTE, "");
  const transition = transitionDocument.startViewTransition(async () => {
    named.forEach(unname);
    let pending: unknown;
    flushSync(() => {
      pending = update();
    });
    if (pending instanceof Promise) {
      await Promise.race([pending, new Promise((resolve) => setTimeout(resolve, ROUTE_WAIT_MS))]);
    }
    named = nameInvolved(keys);
  });
  void transition.finished.finally(() => {
    named.forEach(unname);
    rows.forEach(unname);
    root.removeAttribute(MORPH_ATTRIBUTE);
  });
}
