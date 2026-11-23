/**
 * What a draft can be pointed at, and the one way to point it — see
 * `.fork/customizations.yaml#fork-new-agent-draft` and `#fork-draft-project-quick-picks`.
 */
import { scopedProjectKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import {
  deriveLogicalProjectKeyFromSettings,
  getProjectOrderKey,
  pickableProjectGroups,
  selectProjectGroupingSettings,
} from "@t3tools/client-runtime/state/project-grouping";
import type { ScopedProjectRef } from "@t3tools/contracts";

import { openCommandPalette } from "~/commandPaletteBus";
import {
  orderItemsByPreferredIds,
  rankRecentProjectEntries,
  sortLogicalProjectsForSidebar,
} from "~/components/Sidebar.logic";
import { toastManager } from "~/components/ui/toast";

import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useScratchProject } from "~/hooks/useScratchProject";
import { useClientSettings } from "~/hooks/useSettings";
import {
  buildSidebarProjectPickerEntries,
  buildSidebarProjectSnapshots,
  type SidebarProjectPickerEntry,
} from "~/sidebarProjectGrouping";
import { useProjects, useQuietThreadShells } from "~/state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "~/state/environments";
import { legacyProjectCwdPreferenceKey, useUiStateStore } from "~/uiStateStore";
import { rememberDraftProjectPick } from "./draftProjectPickMotion";
import { isUnassignedDraft, resolveNoProjectEnvironmentId } from "./newAgentDraft";
import {
  type DraftProjectAssignOptions,
  useAssignDraftProject,
  useDraftProjectAssignmentPending,
} from "./useNewAgentDraft";

/** How many recent projects an unassigned draft's launchpad lists before "All projects";
    the composer is centred, so the launchpad has roughly half a window to fit in. */
export const QUICK_PICK_LIMIT = 4;

/** Short windows pin the composer to the bottom and put the slot under it in flow
    (ChatView), leaving no room for the launchpad; the project chip stands in there. */
export const SHORT_WINDOW_QUERY = "(max-height: 34rem)";

/** The radio value of the "No project" row, and its pending key while the
    scratch project opens; never a logical project key. */
export const NO_PROJECT_VALUE = "no-project";

/** What the chip shows: nothing chosen yet, "No project", or a project.
    `pending` while a pick is still moving the draft. */
type DraftProjectSelection =
  | { readonly kind: "unassigned" }
  | { readonly kind: "no-project"; readonly pending: boolean }
  | {
      readonly kind: "project";
      readonly entry: SidebarProjectPickerEntry | null;
      readonly label: string;
      readonly pending: boolean;
    };

/** A pick in flight shows ahead of where the draft still points. */
function resolveDraftProjectSelection(input: {
  readonly pendingProjectKey: string | null;
  readonly pendingEntry: SidebarProjectPickerEntry | null;
  readonly activeIsScratch: boolean;
  readonly activeEntry: SidebarProjectPickerEntry | null;
  readonly activeProjectTitle: string | null;
}): DraftProjectSelection {
  if (input.pendingProjectKey === NO_PROJECT_VALUE) return { kind: "no-project", pending: true };
  if (input.pendingEntry !== null) {
    return {
      kind: "project",
      entry: input.pendingEntry,
      label: input.pendingEntry.group.displayName,
      pending: true,
    };
  }
  if (input.activeIsScratch) return { kind: "no-project", pending: false };
  const label = input.activeEntry?.group.displayName ?? input.activeProjectTitle;
  return label === null
    ? { kind: "unassigned" }
    : { kind: "project", entry: input.activeEntry, label, pending: false };
}

export const openAddProject = () => openCommandPalette({ open: "add-project" });

export function useDraftProjectChoices(props: {
  readonly draftId: DraftId | null;
  readonly activeProjectRef: ScopedProjectRef | null;
  /** The resolved project's title, or null when the ref names no project:
      an unassigned "New agent" draft, or a project since removed. */
  readonly activeProjectTitle: string | null;
}) {
  const { draftId, activeProjectRef } = props;
  const allProjects = useProjects();
  const { scratchWorkspaceRootFor, scratchEnvironmentId, openScratchProject } = useScratchProject();
  // The environment's scratch folder is upstream's "No project" home: it is
  // offered as its own row, never listed as a project.
  const projects: EnvironmentProject[] = [];
  const scratchProjects: EnvironmentProject[] = [];
  for (const project of allProjects) {
    (isScratchProject(project, scratchWorkspaceRootFor(project.environmentId))
      ? scratchProjects
      : projects
    ).push(project);
  }
  const threads = useQuietThreadShells();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const projectSortOrder = useClientSettings((settings) => settings.sidebarProjectSortOrder);
  const projectOrder = useUiStateStore((store) => store.projectOrder);
  const assignDraftProject = useAssignDraftProject();
  const pendingProjectKey = useDraftProjectAssignmentPending(draftId);
  const draftIsUnassigned = useComposerDraftStore((store) =>
    draftId ? isUnassignedDraft(store.getDraftSession(draftId)) : false,
  );
  const noProjectEnvironmentId = resolveNoProjectEnvironmentId({
    draftIsUnassigned,
    draftEnvironmentId: activeProjectRef?.environmentId ?? null,
    primaryEnvironmentId,
    scratchWorkspaceRootFor,
    scratchEnvironmentId,
  });

  const environmentLabelById = new Map(
    environments.map((environment) => [environment.environmentId, environment.label] as const),
  );
  const projectGroups = sortLogicalProjectsForSidebar(
    buildSidebarProjectSnapshots({
      projects:
        projectSortOrder === "manual"
          ? orderItemsByPreferredIds({
              items: projects,
              preferredIds: projectOrder,
              getId: getProjectOrderKey,
              getPreferenceIds: (project) => [
                getProjectOrderKey(project),
                legacyProjectCwdPreferenceKey(project.workspaceRoot),
              ],
            })
          : projects,
      settings: projectGroupingSettings,
      primaryEnvironmentId,
      resolveEnvironmentLabel: (environmentId) => environmentLabelById.get(environmentId) ?? null,
    }),
    threads,
    projectSortOrder,
  );
  const entries = buildSidebarProjectPickerEntries({
    // Upstream: an archived project is not a choice for a new thread.
    groups: pickableProjectGroups(projectGroups),
    preferredProjectRef: activeProjectRef,
  });
  const entryByKey = new Map(entries.map((entry) => [entry.group.projectKey, entry] as const));
  // A pick shows on the pill the moment it is made; the draft itself moves
  // once the project's defaults resolve, and Send waits for that (the
  // composer reads the same pending state).
  const activeKey = activeProjectRef === null ? null : scopedProjectKey(activeProjectRef);
  const selection = resolveDraftProjectSelection({
    pendingProjectKey,
    pendingEntry: pendingProjectKey === null ? null : (entryByKey.get(pendingProjectKey) ?? null),
    activeIsScratch: scratchProjects.some(
      (project) =>
        scopedProjectKey({ environmentId: project.environmentId, projectId: project.id }) ===
        activeKey,
    ),
    activeEntry:
      entries.find((entry) =>
        entry.group.memberProjectRefs.some(
          (projectRef) => scopedProjectKey(projectRef) === activeKey,
        ),
      ) ?? null,
    activeProjectTitle: props.activeProjectTitle,
  });
  const value =
    selection.kind === "no-project"
      ? NO_PROJECT_VALUE
      : selection.kind === "project"
        ? (selection.entry?.group.projectKey ?? "")
        : "";
  // No repository yet (unassigned, or No project): the launchpad lists the recent projects.
  const needsProject = selection.kind !== "project";
  const recentEntries =
    needsProject && draftId !== null
      ? rankRecentProjectEntries(entries, threads, QUICK_PICK_LIMIT)
      : null;

  const reportAssignFailure = (displayName: string, error: unknown) => {
    console.error(error);
    toastManager.add({
      type: "error",
      title: `Couldn't switch to ${displayName}`,
      description: error instanceof Error ? error.message : "An error occurred.",
    });
  };

  /** Points the draft at a menu or launchpad row's value; `pill` is the row picked, which the chip opens from. */
  const pick = (next: string, pill?: Element, options?: DraftProjectAssignOptions) => {
    if (draftId === null || next === value) return;
    if (next === NO_PROJECT_VALUE) {
      if (noProjectEnvironmentId === null) return;
      if (pill) rememberDraftProjectPick(draftId, pill);
      // The scratch project exists only once the server has made it, so the
      // pick opens it first, already pending; openScratchProject reports its
      // own failure.
      void assignDraftProject(draftId, {
        pendingKey: NO_PROJECT_VALUE,
        environmentId: noProjectEnvironmentId,
        resolve: async () => {
          const project = await openScratchProject(noProjectEnvironmentId);
          return project === null
            ? null
            : {
                group: {
                  projectKey: deriveLogicalProjectKeyFromSettings(project, projectGroupingSettings),
                },
                targetProject: project,
              };
        },
      }).catch((error: unknown) => reportAssignFailure("No project", error));
      return;
    }
    const entry = entryByKey.get(next);
    if (!entry) return;
    if (pill) rememberDraftProjectPick(draftId, pill);
    // A failed pick leaves the draft on its previous project, so say so.
    void assignDraftProject(draftId, entry, options).catch((error: unknown) =>
      reportAssignFailure(entry.group.displayName, error),
    );
  };

  return {
    entries,
    recentEntries,
    selection,
    needsProject,
    value,
    pending: selection.kind !== "unassigned" && selection.pending,
    noProjectEnvironmentId,
    pick,
  };
}

export type DraftProjectChoices = ReturnType<typeof useDraftProjectChoices>;

/** What the shared menu reads: the rows, the checked value and the dispatcher. */
export type DraftProjectMenuChoices = Pick<
  DraftProjectChoices,
  "entries" | "value" | "pick" | "noProjectEnvironmentId"
>;
