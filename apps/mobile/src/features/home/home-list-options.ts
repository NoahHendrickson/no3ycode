import type { EnvironmentId, SidebarProjectGroupingMode } from "@t3tools/contracts";
import { DEFAULT_SIDEBAR_PROJECT_SORT_ORDER } from "@t3tools/contracts";
import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import { createContext, createElement, useContext, useState, type PropsWithChildren } from "react";

import type { ThreadListFilters } from "../../persistence/mobile-preferences";
import { updateMobilePreferencesAtom } from "../../state/preferences";
import type { HomeProjectSortOrder } from "./homeThreadList";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import type { No3yStatusFilter, No3yThreadSortOrder } from "../../../fork/mobileStatusGrouping";
/* fork:end no3y-mobile-redesign */

export interface HomeListOptions {
  readonly selectedEnvironmentId: EnvironmentId | null;
  readonly selectedProjectKey: string | null;
  readonly projectSortOrder: HomeProjectSortOrder;
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  readonly statusFilter: No3yStatusFilter;
  readonly threadSortOrder: No3yThreadSortOrder;
  /* fork:end no3y-mobile-redesign */
}

export interface ResolvedHomeListOptions extends HomeListOptions {
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

function defaultHomeListOptions(filters?: ThreadListFilters): HomeListOptions {
  return {
    selectedEnvironmentId: filters?.environmentId ?? null,
    selectedProjectKey: filters?.projectKey ?? null,
    projectSortOrder:
      DEFAULT_SIDEBAR_PROJECT_SORT_ORDER === "manual"
        ? "updated_at"
        : DEFAULT_SIDEBAR_PROJECT_SORT_ORDER,
    /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
    statusFilter: "all",
    threadSortOrder: "status",
    /* fork:end no3y-mobile-redesign */
  };
}

interface HomeListOptionsContextValue {
  readonly options: HomeListOptions;
  readonly updateOptions: (patch: Partial<HomeListOptions>) => void;
  readonly projectGroupingMode: SidebarProjectGroupingMode;
}

const HomeListOptionsContext = createContext<HomeListOptionsContextValue | null>(null);

export function HomeListOptionsProvider({
  children,
  projectGroupingMode,
  savedFilters,
}: PropsWithChildren<{
  readonly projectGroupingMode: SidebarProjectGroupingMode;
  readonly savedFilters?: ThreadListFilters | undefined;
}>) {
  const registry = useContext(RegistryContext);
  const [optionsAtom] = useState(() => Atom.make(defaultHomeListOptions(savedFilters)));
  const options = useAtomValue(optionsAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  // Only the scope persists; the sort order is per session. Updates read the
  // registry, so several in one event each build on the last and save it.
  const updateOptions = (patch: Partial<HomeListOptions>) => {
    const current = registry.get(optionsAtom);
    const next = { ...current, ...patch };
    registry.set(optionsAtom, next);
    if (
      next.selectedEnvironmentId !== current.selectedEnvironmentId ||
      next.selectedProjectKey !== current.selectedProjectKey
    ) {
      savePreferences({
        threadListFilters: {
          environmentId: next.selectedEnvironmentId,
          projectKey: next.selectedProjectKey,
        },
      });
    }
  };
  const value = { options, updateOptions, projectGroupingMode };
  return createElement(HomeListOptionsContext, { value }, children);
}

export function useHomeListOptions(availableEnvironmentIds: ReadonlySet<EnvironmentId>) {
  const shared = useContext(HomeListOptionsContext);
  const [localOptions, setLocalOptions] = useState<HomeListOptions>(defaultHomeListOptions);
  const options = shared?.options ?? localOptions;
  const updateOptions =
    shared?.updateOptions ??
    ((patch: Partial<HomeListOptions>) => setLocalOptions((current) => ({ ...current, ...patch })));
  const selectedEnvironmentId =
    options.selectedEnvironmentId !== null &&
    availableEnvironmentIds.has(options.selectedEnvironmentId)
      ? options.selectedEnvironmentId
      : null;
  const availableOptions =
    selectedEnvironmentId === options.selectedEnvironmentId
      ? options
      : { ...options, selectedEnvironmentId };
  const resolvedOptions: ResolvedHomeListOptions = {
    ...availableOptions,
    projectGroupingMode: shared?.projectGroupingMode ?? "repository",
  };

  const setSelectedEnvironmentId = (value: EnvironmentId | null) => {
    updateOptions({ selectedEnvironmentId: value });
  };
  const setSelectedProjectKey = (value: string | null) => {
    updateOptions({ selectedProjectKey: value });
  };
  const setProjectSortOrder = (value: HomeProjectSortOrder) => {
    updateOptions({ projectSortOrder: value });
  };
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const setStatusFilter = (value: No3yStatusFilter) => {
    updateOptions({ statusFilter: value });
  };
  const setThreadSortOrder = (value: No3yThreadSortOrder) => {
    updateOptions({ threadSortOrder: value });
  };
  /* fork:end no3y-mobile-redesign */
  return {
    options: resolvedOptions,
    setSelectedEnvironmentId,
    setSelectedProjectKey,
    setProjectSortOrder,
    /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
    setStatusFilter,
    setThreadSortOrder,
    /* fork:end no3y-mobile-redesign */
  } as const;
}
