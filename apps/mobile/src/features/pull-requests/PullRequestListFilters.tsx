import { useAtomValue } from "@effect/atom-react";
import { sortProjectsByGroupOrder } from "@t3tools/client-runtime/state/project-grouping";
import type { ScopedProjectRef, SidebarProjectGroupingMode } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { msg, useGT, useMessages } from "gt-react-native";
import type { ReactNode } from "react";
import { Platform, ScrollView } from "react-native";
import type { MenuProps } from "../../components/ui/Menu.types";
import { ListFilterMenu } from "../layout/workspace/ListFilterMenu";
import { environmentProjects } from "../../state/projects";
import { environmentThreadShells } from "../../state/threads";
import { useMobileProjectGroupingSettings } from "../../state/project-grouping";
import { buildHomeProjectScopes, sortHomeProjectScopes } from "../home/homeThreadList";
import { DEFAULT_PR_LIST_CONTROLS, type PullRequestListControls } from "./pullRequestList";
import type { MessageResolver } from "../../i18n/messages";
/* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
import {
  pullRequestProjectSelected,
  toggledPullRequestProject,
} from "../../../fork/no3yPullRequestProjects";
/* fork:end no3y-pr-project-multiselect */

const STATES = {
  open: msg("Open", { $context: "pull request state filter" }),
  closed: msg("Closed", { $context: "pull request state filter" }),
  merged: msg("Merged", { $context: "pull request state filter" }),
  all: msg("All states"),
};
const INVOLVEMENT = {
  all: msg("All PRs"),
  reviewing: msg("Your review"),
  authored: msg("By you"),
};
const DRAFTS = { all: msg("All drafts"), only: msg("Drafts only"), hide: msg("Hide drafts") };
const REVIEWS = {
  all: msg("All reviews"),
  approved: msg("Approved", { $context: "review status filter" }),
  "changes-requested": msg("Changes requested"),
  "review-required": msg("Review required"),
  none: msg("No reviews"),
};
const CHECKS = {
  all: msg("All checks"),
  passing: msg("Passing", { $context: "CI checks filter" }),
  failing: msg("Failing", { $context: "CI checks filter" }),
};
const CHECKS_TITLES = { passing: msg("Passing checks"), failing: msg("Failing checks") };
const SORTS = {
  updated: msg("Recently updated"),
  created: msg("Newest created"),
  oldest: msg("Oldest updated"),
};
const resolveOptions = <Key extends string>(
  options: Readonly<Record<Key, string>>,
  resolve: MessageResolver,
) =>
  Object.fromEntries(Object.entries<string>(options).map(([key, title]) => [key, resolve(title)]));
// A 12dp inset keeps 16dp chips concentric with Android's 28dp ScreenContent corner.
const ROW_STYLE =
  Platform.OS === "android"
    ? { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 8 }
    : { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10, gap: 8 };
const id = (field: string, value: string) => JSON.stringify([field, value]);
function choices(field: string, options: Readonly<Record<string, string>>, selected: string) {
  return Object.entries(options).map(([value, title]) => ({
    id: id(field, value),
    title,
    state: value === selected ? ("on" as const) : ("off" as const),
  }));
}

type ProjectOrder = readonly {
  readonly memberProjectRefs: readonly ScopedProjectRef[];
  readonly pinned: boolean;
  readonly archived: boolean;
}[];
const sameProjectOrder = (previous: ProjectOrder, next: ProjectOrder) =>
  previous.length === next.length &&
  previous.every((group, index) => {
    const members = next[index]!.memberProjectRefs;
    return (
      group.pinned === next[index]!.pinned &&
      group.archived === next[index]!.archived &&
      group.memberProjectRefs.length === members.length &&
      group.memberProjectRefs.every(
        (ref, member) =>
          ref.environmentId === members[member]!.environmentId &&
          ref.projectId === members[member]!.projectId,
      )
    );
  });

// Thread shells change on every agent tick, but the sidebar order they decide rarely does. The
// equality check keeps the list screen, which builds these filters, from re-rendering on each tick.
const sidebarProjectOrderFamily = Atom.family((mode: SidebarProjectGroupingMode) =>
  Atom.make((get) =>
    sortHomeProjectScopes({
      scopes: buildHomeProjectScopes({
        projects: get(environmentProjects.projectsAtom),
        environmentId: null,
        projectGroupingMode: mode,
      }),
      threads: get(environmentThreadShells.threadShellsAtom),
      pendingTasks: [],
      projectSortOrder: "updated_at",
    }).map((scope) => ({
      memberProjectRefs: scope.projectRefs,
      pinned: scope.pinned,
      archived: scope.archived,
    })),
  ).pipe(Atom.withEquality(sameProjectOrder)),
);

function useProjectsInSidebarOrder<Project extends { id: string; environmentId: string }>(
  projects: readonly Project[],
) {
  const { sidebarProjectGroupingMode } = useMobileProjectGroupingSettings();
  const scopes = useAtomValue(sidebarProjectOrderFamily(sidebarProjectGroupingMode));
  return sortProjectsByGroupOrder(projects, scopes);
}

export interface PullRequestFilterMenu {
  readonly actions: MenuProps["actions"];
  readonly onSelect: (id: string) => void;
  /** Whether any filter, the environment, or a non-default sort is active. */
  readonly customized: boolean;
}

/**
 * Builds the filter pills and, on Android, the header's full filter menu. The list screen owns
 * the call so both the pills and the header it frames read the same menu.
 */
export function usePullRequestListFilters(props: {
  readonly environments: readonly { id: string; label: string }[];
  readonly environmentId: string | null;
  readonly onEnvironmentChange: (id: string | null) => void;
  readonly value: PullRequestListControls;
  readonly onChange: (value: PullRequestListControls) => void;
  readonly authors: readonly string[];
  readonly labels: readonly string[];
  /** Dot colors by lowercased label name, for the labels that have one. */
  readonly labelColors: Readonly<Record<string, string>>;
  readonly projects: readonly { id: string; title: string; environmentId: string }[];
  /** Opens a picker that searches the host, for a label or author no loaded row carries. */
  readonly onSearch: (kind: "labels" | "authors") => void;
}) {
  const { value } = props;
  const m = useMessages();
  /* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */
  const gt = useGT();
  /* fork:end no3y-pr-list-bottom-filters */
  const projects = useProjectsInSidebarOrder(props.projects);
  const selectedLabels = value.filters.labels?.flat() ?? [];
  const selectedLabelSet = new Set(selectedLabels);
  const author = value.filters.author;
  /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
  const projectSelection = value.projects ?? [];
  const selectedProjects = projects.filter((project) =>
    pullRequestProjectSelected(projectSelection, {
      projectId: project.id,
      environmentId: project.environmentId,
    }),
  );
  /* fork:end no3y-pr-project-multiselect */
  const select = (event: string) => {
    let selection: unknown;
    try {
      selection = JSON.parse(event);
    } catch {
      return;
    }
    if (
      !Array.isArray(selection) ||
      selection.length !== 2 ||
      typeof selection[0] !== "string" ||
      typeof selection[1] !== "string"
    )
      return;
    const [field, next] = selection;
    switch (field) {
      case "environment":
        if (next === "") props.onEnvironmentChange(null);
        else if (props.environments.some((environment) => environment.id === next))
          props.onEnvironmentChange(next);
        break;
      case "reset":
        props.onChange(DEFAULT_PR_LIST_CONTROLS);
        // The Android header menu also holds the environment, so its reset clears that too.
        if (next === "environment") props.onEnvironmentChange(null);
        break;
      case "state":
        props.onChange({ ...value, state: next as PullRequestListControls["state"] });
        break;
      case "involvement":
        props.onChange({ ...value, involvement: next as PullRequestListControls["involvement"] });
        break;
      case "sort":
        props.onChange({ ...value, sort: next as PullRequestListControls["sort"] });
        break;
      case "project": {
        /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
        const project = projects.find(
          (project) => JSON.stringify([project.environmentId, project.id]) === next,
        );
        props.onChange({
          ...value,
          projects: project
            ? toggledPullRequestProject(projectSelection, {
                projectId: project.id,
                environmentId: project.environmentId,
              })
            : undefined,
        });
        /* fork:end no3y-pr-project-multiselect */
        break;
      }
      case "label": {
        const labels = selectedLabels.includes(next)
          ? selectedLabels.filter((label) => label !== next)
          : [...selectedLabels, next].slice(0, 10);
        props.onChange({
          ...value,
          filters: {
            ...value.filters,
            labels: labels.length ? labels.map((label) => [label]) : undefined,
          },
        });
        break;
      }
      case "labels":
        props.onChange({ ...value, filters: { ...value.filters, labels: undefined } });
        break;
      case "author":
        props.onChange({ ...value, filters: { ...value.filters, author: next || undefined } });
        break;
      case "search":
        if (next === "labels" || next === "authors") props.onSearch(next);
        break;
      case "draft":
        props.onChange({
          ...value,
          filters: {
            ...value.filters,
            draft: next === "all" ? undefined : (next as "only" | "hide"),
          },
        });
        break;
      case "review":
        props.onChange({
          ...value,
          filters: {
            ...value.filters,
            review:
              next === "all"
                ? undefined
                : (next as NonNullable<PullRequestListControls["filters"]["review"]>),
          },
        });
        break;
      case "checks":
        props.onChange({
          ...value,
          filters: {
            ...value.filters,
            checks: next === "all" ? undefined : (next as "passing" | "failing"),
          },
        });
        break;
    }
  };
  const count =
    Number(value.state !== "open") +
    Number(value.involvement !== "all") +
    Number(Boolean(author)) +
    selectedLabels.length +
    Number(Boolean(value.filters.draft)) +
    Number(Boolean(value.filters.review)) +
    Number(Boolean(value.filters.checks)) +
    /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
    projectSelection.length;
  /* fork:end no3y-pr-project-multiselect */
  /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
  // Several projects read as the first one's name and how many more, which needs no new copy.
  const projectLabel = selectedProjects.length
    ? selectedProjects.length > 1
      ? `${selectedProjects[0]!.title} +${selectedProjects.length - 1}`
      : selectedProjects[0]!.title
    : m(msg("Project", { $context: "filter menu" }));
  const projectActions: MenuProps["actions"] = [
    {
      id: id("project", ""),
      title: m(msg("All projects")),
      state: projectSelection.length ? "off" : "on",
    },
    ...projects.map((project) => ({
      id: id("project", JSON.stringify([project.environmentId, project.id])),
      title: project.title,
      state: selectedProjects.includes(project) ? ("on" as const) : ("off" as const),
      // Ticking a project leaves the menu open for the next one.
      attributes: { keepsMenuPresented: true },
    })),
  ];
  const projectMenu = { id: "projects", title: projectLabel, subactions: projectActions };
  /* fork:end no3y-pr-project-multiselect */
  const more: MenuProps["actions"] = [
    {
      id: "drafts",
      title: value.filters.draft
        ? m(DRAFTS[value.filters.draft])
        : m(msg("Drafts", { $context: "filter menu" })),
      subactions: choices("draft", resolveOptions(DRAFTS, m), value.filters.draft ?? "all"),
    },
    {
      id: "reviews",
      title: value.filters.review
        ? m(REVIEWS[value.filters.review])
        : m(msg("Reviews", { $context: "filter menu" })),
      subactions: choices("review", resolveOptions(REVIEWS, m), value.filters.review ?? "all"),
    },
    {
      id: "checks",
      title: value.filters.checks
        ? m(CHECKS_TITLES[value.filters.checks])
        : m(msg("Checks", { $context: "filter menu" })),
      subactions: choices("checks", resolveOptions(CHECKS, m), value.filters.checks ?? "all"),
    },
    /* fork:begin no3y-pr-project-multiselect — see .fork/customizations.yaml#no3y-pr-project-multiselect */
    projectMenu,
    /* fork:end no3y-pr-project-multiselect */
    {
      id: "sort",
      title: m(SORTS[value.sort]),
      subactions: choices("sort", resolveOptions(SORTS, m), value.sort),
    },
  ];
  const reset = (withEnvironment: boolean): MenuProps["actions"][number] => ({
    id: id("reset", withEnvironment ? "environment" : ""),
    title: m(msg("Reset filters")),
    attributes: {
      disabled:
        count === 0 &&
        value.sort === "updated" &&
        (!withEnvironment || props.environmentId === null),
    },
  });
  const labels = [...new Set([...selectedLabels, ...props.labels])].slice(0, 60);
  const authors = [
    ...new Set([...(author && author !== "me" ? [author] : []), ...props.authors]),
  ].slice(0, 60);
  const environmentActions = choices(
    "environment",
    Object.fromEntries([
      ["", m(msg("All environments"))],
      ...props.environments.map((environment) => [environment.id, environment.label]),
    ]),
    props.environmentId ?? "",
  );
  const stateActions = choices("state", resolveOptions(STATES, m), value.state);
  const involvementActions = choices(
    "involvement",
    resolveOptions(INVOLVEMENT, m),
    value.involvement,
  );
  const labelActions: MenuProps["actions"] = [
    { id: id("search", "labels"), title: m(msg("Search labels…")), image: "magnifyingglass" },
    {
      id: id("labels", ""),
      title: m(msg("All labels")),
      state: selectedLabels.length ? "off" : "on",
    },
    ...labels.map((label) => {
      const color = props.labelColors[label.toLowerCase()];
      return {
        id: id("label", label),
        title: label,
        state: selectedLabelSet.has(label) ? ("on" as const) : ("off" as const),
        ...(color ? { image: "circle.fill", imageColor: color } : {}),
      };
    }),
  ];
  const authorActions: MenuProps["actions"] = [
    { id: id("search", "authors"), title: m(msg("Search authors…")), image: "magnifyingglass" },
    ...choices(
      "author",
      Object.fromEntries([
        ["", m(msg("All authors"))],
        ["me", m(msg("Me", { $context: "author filter, the current user" }))],
        ...authors.map((login) => [login, login]),
      ]),
      author ?? "",
    ),
  ];
  const customized = count > 0 || value.sort !== "updated" || props.environmentId !== null;
  // The Android header's filter button opens every filter.
  const headerMenu: PullRequestFilterMenu | null =
    Platform.OS === "android"
      ? {
          actions: [
            {
              id: "environment",
              title: m(msg("Environment", { $context: "filter menu" })),
              subactions: environmentActions,
            },
            {
              id: "state",
              title: m(msg("State", { $context: "filter menu" })),
              subactions: stateActions,
            },
            {
              id: "involvement",
              title: m(msg("Involvement", { $context: "filter menu" })),
              subactions: involvementActions,
            },
            {
              id: "labels",
              title: m(msg("Labels", { $context: "filter menu" })),
              subactions: labelActions,
            },
            {
              id: "author",
              title: m(msg("Author", { $context: "filter menu" })),
              subactions: authorActions,
            },
            ...more,
            reset(true),
          ],
          onSelect: select,
          customized,
        }
      : null;
  /* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */
  const environmentLabel =
    props.environments.length > 1
      ? (props.environments.find((environment) => environment.id === props.environmentId)?.label ??
        m(msg("All environments")))
      : null;
  // Each chip once; upstream's header row and the iPhone bottom tray lay them out in their orders.
  const chips = {
    filters: {
      key: "filters",
      label: count ? String(count) : gt("Filters"),
      icon: true,
      active: count > 0,
      accessibilityLabel: count
        ? gt("{count, plural, one {Filters, {count} active} other {Filters, {count} active}}", {
            count,
          })
        : gt("More filters"),
      actions: [...more, reset(false)],
    },
    environment:
      environmentLabel === null
        ? null
        : {
            key: "environment",
            label: environmentLabel,
            accessibilityLabel: gt("Choose pull request environment"),
            actions: environmentActions,
          },
    state: {
      key: "state",
      label: m(STATES[value.state]),
      active: value.state !== "open",
      accessibilityLabel: gt("Filter by state"),
      actions: stateActions,
    },
    involvement: {
      key: "involvement",
      label: m(INVOLVEMENT[value.involvement]),
      active: value.involvement !== "all",
      accessibilityLabel: gt("Filter by involvement"),
      actions: involvementActions,
    },
    labels: {
      key: "labels",
      label: selectedLabels.length
        ? gt("Labels {count}", { count: selectedLabels.length })
        : gt("Labels", { $context: "filter menu" }),
      active: selectedLabels.length > 0,
      accessibilityLabel: gt("Filter by label"),
      actions: labelActions,
    },
    author: {
      key: "author",
      label: author === "me" ? gt("By you") : (author ?? gt("Author", { $context: "filter menu" })),
      active: Boolean(author),
      accessibilityLabel: gt("Filter by author"),
      actions: authorActions,
    },
    project: {
      key: "project",
      label: projectLabel,
      active: projectSelection.length > 0,
      accessibilityLabel: gt("Filter by project"),
      actions: projectActions,
    },
  } satisfies Record<string, FilterChip | null>;
  /* fork:end no3y-pr-list-bottom-filters */
  return {
    headerMenu,
    select,
    count,
    more,
    reset,
    /* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */
    moreWithoutProject: more.filter((action) => action !== projectMenu),
    chips,
    /* fork:end no3y-pr-list-bottom-filters */
  };
}

/* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */
export interface FilterChip {
  readonly key: string;
  readonly label: string;
  readonly accessibilityLabel: string;
  readonly active?: boolean;
  readonly icon?: boolean;
  readonly actions: MenuProps["actions"];
}

export function FilterChipMenu(props: {
  readonly chip: FilterChip;
  readonly onSelect: (id: string) => void;
}) {
  const { key: _key, ...chip } = props.chip;
  return <ListFilterMenu {...chip} onSelect={props.onSelect} />;
}
/* fork:end no3y-pr-list-bottom-filters */

export function PullRequestListFilters(props: {
  /** Android sidebar rows sit further in than full-width rows; the pills follow them. */
  readonly sidebar?: boolean;
  readonly filters: ReturnType<typeof usePullRequestListFilters>;
  readonly savedViewsMenu: ReactNode;
}) {
  /* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */
  const { select, chips } = props.filters;
  /* fork:end no3y-pr-list-bottom-filters */
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ overflow: "visible" }}
      // In the Android sidebar the first pill lines up with the rows' content instead
      // (8dp row margin + 12dp padding).
      contentContainerStyle={
        props.sidebar && Platform.OS === "android"
          ? { ...ROW_STYLE, paddingHorizontal: 20 }
          : ROW_STYLE
      }
    >
      {props.savedViewsMenu}
      {/* fork:begin no3y-pr-list-bottom-filters — see .fork/customizations.yaml#no3y-pr-list-bottom-filters */}
      {[
        Platform.OS === "android" ? null : chips.filters,
        chips.environment,
        chips.state,
        chips.involvement,
        chips.labels,
        chips.author,
      ].map((chip) =>
        chip ? <FilterChipMenu key={chip.key} chip={chip} onSelect={select} /> : null,
      )}
      {/* fork:end no3y-pr-list-bottom-filters */}
    </ScrollView>
  );
}
