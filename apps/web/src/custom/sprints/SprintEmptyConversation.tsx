/**
 * A sprint's empty conversation — see `.fork/customizations.yaml#fork-sprints`. A few ways to
 * start; a chip writes its prompt into the composer draft and never sends it.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import { useComposerDraftStore } from "~/composerDraftStore";

const SPRINT_STARTERS = [
  {
    label: "Plan this sprint from its goal",
    prompt:
      "Plan this sprint from the goal in PLAN.md: write its phases and what you would start first, then check with me before starting any threads.",
  },
  {
    label: "Explore the project and suggest what to work on",
    prompt:
      "Start a thread that explores the project and saves a short report to the library of what this sprint should work on. When it reports, suggest a plan from it.",
  },
  {
    label: "What's the status of everything?",
    prompt: "What's the status of everything?",
  },
] as const;

export function SprintEmptyConversation(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly title: string;
}) {
  const write = (prompt: string) => {
    const store = useComposerDraftStore.getState();
    const written = store.getComposerDraft(props.sprintRef)?.prompt ?? "";
    if (written.includes(prompt)) return;
    store.setPrompt(props.sprintRef, written.trim() === "" ? prompt : `${written}\n\n${prompt}`);
  };
  return (
    <div className="flex flex-col items-center gap-4" data-testid="sprint-empty-conversation">
      <p className="text-sm text-muted-foreground">
        Tell {props.title} what to work on, or start with one of these.
      </p>
      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {SPRINT_STARTERS.map((starter) => (
          <Button
            key={starter.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => write(starter.prompt)}
          >
            {starter.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
