/**
 * A sprint's empty conversation — see `.fork/customizations.yaml#fork-sprints`. A few ways to
 * start, in the split agent's starter card; a row writes its prompt into the composer draft and
 * never sends it.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { useComposerDraftStore } from "~/composerDraftStore";

import { ActivityIcon, SearchIcon, TargetIcon } from "../icons/lucide-hugeicons";
import { StarterCard } from "../StarterCard";

const SPRINT_STARTERS = [
  {
    key: "plan",
    label: "Plan this sprint from its goal",
    Icon: TargetIcon,
    prompt:
      "Plan this sprint from the goal in PLAN.md: write its phases and what you would start first, then check with me before starting any threads.",
  },
  {
    key: "explore",
    label: "Explore the project and suggest what to work on",
    Icon: SearchIcon,
    prompt:
      "Start a thread that explores the project and saves a short report to the library of what this sprint should work on. When it reports, suggest a plan from it.",
  },
  {
    key: "status",
    label: "What's the status of everything?",
    Icon: ActivityIcon,
    prompt: "What's the status of everything?",
  },
] as const;

export function SprintEmptyConversation(props: { readonly sprintRef: ScopedThreadRef }) {
  const write = (prompt: string) => {
    const store = useComposerDraftStore.getState();
    const written = store.getComposerDraft(props.sprintRef)?.prompt ?? "";
    if (written.includes(prompt)) return;
    store.setPrompt(props.sprintRef, written.trim() === "" ? prompt : `${written}\n\n${prompt}`);
  };
  return (
    <div className="flex w-full justify-center px-4" data-testid="sprint-empty-conversation">
      <StarterCard starters={SPRINT_STARTERS} onPick={write} />
    </div>
  );
}
