/**
 * Moves an unassigned "New agent" draft between connected machines — see
 * `.fork/customizations.yaml#fork-new-agent-draft`. Options mirror upstream's
 * `useLogicalProjectEnvironments`, whose selector takes over once a project is picked.
 */
import { canCreateProjectInEnvironment } from "@t3tools/client-runtime/operations/projects";
import { resolveEnvironmentMachineKind } from "@t3tools/contracts";

import type { EnvironmentOption } from "~/components/BranchToolbar.logic";
import { BranchToolbarEnvironmentSelector } from "~/components/BranchToolbarEnvironmentSelector";
import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { isUnassignedDraft } from "./newAgentDraft";
import { moveUnassignedDraft } from "./useNewAgentDraft";

export function DraftMachineChip({ draftId }: { readonly draftId: DraftId | null }) {
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const draftEnvironmentId = useComposerDraftStore((store) => {
    const session = draftId ? store.getDraftSession(draftId) : null;
    return isUnassignedDraft(session) && session?.promotedTo == null
      ? (session?.environmentId ?? null)
      : null;
  });
  if (draftId === null || draftEnvironmentId === null) return null;

  const options: EnvironmentOption[] = environments
    .filter(
      (environment) =>
        environment.environmentId === draftEnvironmentId ||
        canCreateProjectInEnvironment(environment.connection.phase),
    )
    .map((environment) => ({
      environmentId: environment.environmentId,
      projectId: null,
      label: environment.label,
      isPrimary: environment.environmentId === primaryEnvironmentId,
      machine: resolveEnvironmentMachineKind(environment.serverConfig ?? null),
    }))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  if (options.length < 2) return null;

  return (
    <BranchToolbarEnvironmentSelector
      envLocked={false}
      environmentId={draftEnvironmentId}
      availableEnvironments={options}
      onEnvironmentChange={(environmentId) => moveUnassignedDraft(draftId, environmentId)}
    />
  );
}
