/**
 * A sprint's Goal tab — see `.fork/customizations.yaml#fork-sprints`. The goal is the first
 * `Goal:` line of PLAN.md. A save reads the file fresh and rewrites only that line, so the sprint's
 * own changes to the rest of the plan stay, and tells the sprint on its next message.
 */
import type { ScopedThreadRef } from "@t3tools/contracts";

import { stackedThreadToast, toastManager } from "~/components/ui/toast";

import {
  NoSprintFileAccess,
  type SprintFileLens,
  SprintFileFooter,
  useSprintFile,
} from "./SprintFileEditor";
import { parseSprintGoal, SPRINT_PLAN_FILE, withSprintGoal } from "./sprintThreads";

/** PLAN.md's goal line: the editor shows the goal alone. */
const GOAL_LENS: SprintFileLens = {
  read: (plan) => parseSprintGoal(plan) ?? "",
  write: withSprintGoal,
};

export function SprintGoal(props: {
  readonly sprintRef: ScopedThreadRef;
  readonly folder: string;
}) {
  // Read again whenever one of the sprint's runs starts or ends, since the sprint rewrites PLAN.md.
  const plan = useSprintFile(props.sprintRef, props.folder, SPRINT_PLAN_FILE, GOAL_LENS);
  const { view } = plan;

  const save = async () => {
    if (!view.dirty || plan.saving) return;
    if (await plan.save(view.value.replace(/\s+/g, " ").trim(), true)) return;
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: "Could not save the goal",
        description: "Your change is still here. Try again.",
      }),
    );
  };

  if (!plan.canReadFiles) return <NoSprintFileAccess />;
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-fork-sprint-goal="">
      <p className="shrink-0 px-3.5 pt-2.5 text-xs text-muted-foreground">
        What this sprint works toward. It plans toward the goal and tells you once it looks met.
        Change it whenever the work changes.
      </p>
      <textarea
        aria-label="Goal"
        className="min-h-0 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        value={view.value}
        placeholder={
          plan.disk === null
            ? ""
            : "No goal yet. For example: Redesign the composer for Flat Glass."
        }
        readOnly={plan.disk === null}
        onChange={(event) => plan.edit(event.target.value)}
        onKeyDown={(event) => {
          // One line in PLAN.md, so Enter saves rather than breaking it; not while an IME composes.
          if (
            (event.key === "Enter" && !event.nativeEvent.isComposing) ||
            ((event.metaKey || event.ctrlKey) && event.key === "s")
          ) {
            event.preventDefault();
            void save();
          }
        }}
        data-testid="sprint-goal-editor"
      />
      <SprintFileFooter
        view={view}
        saving={plan.saving}
        staleNote="The sprint changed the goal since you began. Saving replaces its change."
        onSave={() => void save()}
        onDiscard={plan.discard}
        saveTestId="sprint-goal-save"
      />
    </div>
  );
}
