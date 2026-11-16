/**
 * Closing a split's new-agent pane — see `.fork/customizations.yaml#fork-split-threads`. The pane's
 * header and its half of the collapsed tab strip both close it the same way, once the route is off
 * the draft: the pair splits, and the draft goes only while it is still empty.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import {
  composerDraftHasUserContent,
  useComposerDraftStore,
  type DraftId,
} from "~/composerDraftStore";
import { releaseComposerDraftUploads } from "~/lib/composerDraftUploads";

import { useSplitThreadStore } from "./splitThreadStore";

export function releaseSplitDraft(ref: ScopedThreadRef, draftId: DraftId): void {
  useSplitThreadStore.getState().unpair(ref);
  // Only an empty draft is discarded, as "Split agent" left it. One the user has written in,
  // or paired from the sidebar, stays a draft of its own.
  const drafts = useComposerDraftStore.getState();
  if (composerDraftHasUserContent(drafts.getComposerDraft(draftId))) return;
  releaseComposerDraftUploads(draftId);
  drafts.clearDraftThread(draftId);
}
