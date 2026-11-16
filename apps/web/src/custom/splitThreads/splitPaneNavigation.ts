/**
 * Moving between a split's panes, and closing its new-agent pane — see
 * `.fork/customizations.yaml#fork-split-threads`. The pane's header and its half of the collapsed
 * tab strip both close it through `closeSplitDraft`, so the ordering rule lives once.
 */
import type { useNavigate } from "@tanstack/react-router";
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  composerDraftHasUserContent,
  useComposerDraftStore,
  type DraftId,
} from "~/composerDraftStore";
import { releaseComposerDraftUploads } from "~/lib/composerDraftUploads";
import { buildThreadRouteParams } from "~/threadRoutes";

import { type PaneRoute, useSplitThreadStore } from "./splitThreadStore";

/** Puts a pane's thread on the route (replace): how focus moves between panes. */
export function navigateToPane(
  navigate: ReturnType<typeof useNavigate>,
  threadRef: ScopedThreadRef,
  route: PaneRoute,
): Promise<void> {
  return route.kind === "draft"
    ? navigate({ to: "/draft/$draftId", params: { draftId: route.draftId }, replace: true })
    : navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
        replace: true,
      });
}

/**
 * Closes a split's new-agent pane. `leave` moves the route off the draft (to the pane beside it)
 * and answers whether it could: clearing the draft under the route would send it home instead.
 * Then the pair splits, and the draft goes only while it is still empty, as "Split agent" left
 * it; one the user has written in, or paired from the sidebar, stays a draft of its own.
 */
export async function closeSplitDraft(
  leave: () => Promise<boolean>,
  ref: ScopedThreadRef,
  draftId: DraftId,
): Promise<void> {
  if (!(await leave())) return;
  useSplitThreadStore.getState().unpair(ref);
  const drafts = useComposerDraftStore.getState();
  if (composerDraftHasUserContent(drafts.getComposerDraft(draftId))) return;
  releaseComposerDraftUploads(draftId);
  drafts.clearDraftThread(draftId);
}

/** The collapsed tab strip's close for the split pane at `index` (0 or 1): when that pane's draft
    holds the route (`routeDraftId`), the route leaves for the other pane first. */
export function closeSplitDraftAt(
  navigate: ReturnType<typeof useNavigate>,
  paneRefs: readonly ScopedThreadRef[],
  paneDraftIds: readonly (DraftId | null)[],
  index: number,
  routeDraftId: DraftId | null,
): Promise<void> {
  const ref = paneRefs[index];
  const draftId = paneDraftIds[index] ?? null;
  const partner = paneRefs[1 - index];
  const partnerDraftId = paneDraftIds[1 - index] ?? null;
  if (ref === undefined || draftId === null) return Promise.resolve();
  const leave = async () => {
    if (draftId !== routeDraftId) return true;
    if (partner === undefined) return false;
    const route: PaneRoute =
      partnerDraftId === null ? { kind: "server" } : { kind: "draft", draftId: partnerDraftId };
    await navigateToPane(navigate, partner, route);
    return true;
  };
  return closeSplitDraft(leave, ref, draftId);
}
