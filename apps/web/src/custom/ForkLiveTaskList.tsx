/**
 * Live checklist — see `.fork/customizations.yaml#fork-live-task-list`.
 * Icons stay still: the status line below already carries the turn's motion.
 */
import type { OrchestrationV2PlanStep } from "@t3tools/contracts";
import { useGT } from "gt-react";
import { CircleCheckIcon, CircleDotIcon, CircleIcon } from "./icons/lucide-hugeicons";
import { cn } from "~/lib/utils";

export function ForkLiveTaskList({ steps }: { steps: ReadonlyArray<OrchestrationV2PlanStep> }) {
  const gt = useGT();
  return (
    <ol className="mb-3 flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm leading-relaxed">
      {steps.map((step) => (
        <li
          key={step.id}
          className={cn(
            "flex min-w-0 items-center gap-2",
            step.status === "running" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {step.status === "completed" ? (
            <CircleCheckIcon aria-hidden className="size-3.5 shrink-0" />
          ) : step.status === "running" ? (
            <CircleDotIcon aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <CircleIcon aria-hidden className="size-3.5 shrink-0" />
          )}
          <span className="sr-only">
            {step.status === "completed"
              ? gt("Completed")
              : step.status === "running"
                ? gt("Running")
                : gt("Pending")}
          </span>
          <span className="min-w-0 truncate">{step.text}</span>
        </li>
      ))}
    </ol>
  );
}
