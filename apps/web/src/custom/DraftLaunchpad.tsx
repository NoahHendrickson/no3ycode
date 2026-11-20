/** The New agent draft's launchpad under the centred composer: the projects to
    pick from while the draft has none, and new work drawn from open pull
    requests and the checkout's git status. See
    `.fork/customizations.yaml#fork-draft-project-quick-picks`. */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, PullRequestListInput, ScopedProjectRef } from "@t3tools/contracts";
import * as Equal from "effect/Equal";
import { AsyncResult, Atom } from "effect/reactivity";
import { type ReactNode, useRef, useState } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { useComposerDraftStore } from "~/composerDraftStore";
import { usePullRequestList } from "~/state/pullRequests";
import { vcsEnvironment } from "~/state/vcs";
import {
  deriveLaunchpadSuggestions,
  type LaunchpadGitStatus,
  type LaunchpadSuggestion,
  type LaunchpadSuggestionKind,
} from "./draftLaunchpadSuggestions";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleXIcon,
  CloudDownloadIcon,
  EyeIcon,
  FolderIcon,
  FolderPlusIcon,
  GitCommitIcon,
  GitMergeIcon,
  GitPullRequestArrowIcon,
  MessageSquareDashedIcon,
  PenLineIcon,
  SearchIcon,
} from "./icons/lucide-hugeicons";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  QUICK_PICK_LIMIT,
  useDraftProjectChoices,
  type DraftProjectChoices,
} from "./useDraftProjectChoices";

const KIND_ICON: Record<LaunchpadSuggestionKind, typeof CircleXIcon> = {
  conflicts: CircleAlertIcon,
  checks: CircleXIcon,
  changes: PenLineIcon,
  review: EyeIcon,
  commit: GitCommitIcon,
  pull: CloudDownloadIcon,
  "open-pr": GitPullRequestArrowIcon,
  merge: GitMergeIcon,
};

const ROW_CLASS_NAME =
  "flex h-8 w-full min-w-0 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-left text-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";

/** Only what the suggestions read, so a file edit that keeps the counts doesn't re-render. */
const launchpadGitStatusAtom = Atom.family((status: ReturnType<typeof vcsEnvironment.status>) =>
  Atom.map(status, (result): LaunchpadGitStatus | null => {
    const data = AsyncResult.getOrElse(result, () => null);
    if (data === null || !data.isRepo) return null;
    return {
      refName: data.refName,
      isDefaultRef: data.isDefaultRef,
      hasPrimaryRemote: data.hasPrimaryRemote,
      changedFileCount: data.workingTree.files.length,
      hasUpstream: data.hasUpstream,
      behindCount: data.behindCount,
      aheadOfDefaultCount: data.aheadOfDefaultCount ?? 0,
      hasOpenPullRequest: data.pr?.state === "open",
    };
  }).pipe(Atom.withEquality(Equal.equals)),
);
const NO_LAUNCHPAD_GIT_STATUS_ATOM: ReturnType<typeof launchpadGitStatusAtom> = Atom.make(null);

/** One list request per environment, covering the given projects. */
function pullRequestTargets(
  projectRefs: ReadonlyArray<ScopedProjectRef>,
  involvement: "authored" | "reviewing",
) {
  const projectIdsByEnvironment = new Map<EnvironmentId, ScopedProjectRef["projectId"][]>();
  for (const ref of projectRefs) {
    const projectIds = projectIdsByEnvironment.get(ref.environmentId) ?? [];
    projectIds.push(ref.projectId);
    projectIdsByEnvironment.set(ref.environmentId, projectIds);
  }
  return [...projectIdsByEnvironment].map(([environmentId, projectIds]) => ({
    environmentId,
    input: {
      state: "open",
      involvement,
      limit: involvement === "authored" ? 20 : 10,
      projectIds,
    } satisfies PullRequestListInput,
  }));
}

/** A launchpad card: a header row (a label, or the project search) over its rows. */
function Card(props: {
  readonly label?: string;
  readonly header?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card pb-1">
      {props.header ?? (
        <div className="flex h-9 items-center px-3 font-medium text-muted-foreground/70 text-xs">
          {props.label}
        </div>
      )}
      <div className="flex min-w-0 flex-col px-1 pt-1">{props.children}</div>
    </div>
  );
}

export function DraftLaunchpad(
  props: Parameters<typeof useDraftProjectChoices>[0] & {
    /** The checkout a picked project's thread will run in, when it is the project's own
        checkout (not a new worktree); its git status offers commit, pull and open-PR work. */
    readonly checkout: { readonly environmentId: EnvironmentId; readonly cwd: string } | null;
  },
) {
  const choices = useDraftProjectChoices(props);
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const { draftId } = props;
  const unassigned = choices.selection.kind === "unassigned";
  const recent = recentProjectRows(choices);
  // Only the copy a pick runs on (the draft's machine), so the forge account that
  // lists "your" pull requests is the one the task will run under.
  const projectRefs: ScopedProjectRef[] = unassigned
    ? recent.map((entry) => ({
        environmentId: entry.targetProject.environmentId,
        projectId: entry.targetProject.id,
      }))
    : // While a pick is pending, activeProjectRef still names the previous project.
      props.activeProjectRef === null || choices.pending
      ? []
      : [props.activeProjectRef];
  const authored = usePullRequestList(pullRequestTargets(projectRefs, "authored"));
  const reviewing = usePullRequestList(pullRequestTargets(projectRefs, "reviewing"));
  // While a pick is pending, `checkout` still names the previous project's checkout.
  const checkout = unassigned || choices.pending ? null : props.checkout;
  const git = useAtomValue(
    checkout === null
      ? NO_LAUNCHPAD_GIT_STATUS_ATOM
      : launchpadGitStatusAtom(
          vcsEnvironment.status({
            environmentId: checkout.environmentId,
            input: { cwd: checkout.cwd },
          }),
        ),
  );

  if (draftId === null) return null;
  if (choices.entries.length === 0 && choices.noProjectEnvironmentId === null) return null;
  // "No project" is a chat with no repository; there is no project work to suggest.
  if (choices.selection.kind === "no-project") return null;

  const suggestions = deriveLaunchpadSuggestions({
    authored: authored.data?.entries ?? [],
    reviewing: reviewing.data?.entries ?? [],
    git,
  });
  const entryFor = (project: LaunchpadSuggestion["project"]) =>
    project === null
      ? null
      : (choices.entries.find((entry) =>
          entry.group.memberProjectRefs.some(
            (ref) =>
              ref.environmentId === project.environmentId && ref.projectId === project.projectId,
          ),
        ) ?? null);

  const suggestionCard =
    suggestions.length === 0 ? null : (
      <Card label="Start something new">
        {suggestions.map((suggestion) => {
          // An unassigned draft's suggestions span projects, so each leads with its
          // project's icon and picking one picks that project.
          const entry = unassigned ? entryFor(suggestion.project) : null;
          const Icon = KIND_ICON[suggestion.kind];
          return (
            <button
              key={suggestion.id}
              type="button"
              className={ROW_CLASS_NAME}
              onClick={(event) => {
                if (entry !== null) choices.pick(entry.group.projectKey, event.currentTarget);
                setPrompt(draftId, suggestion.prompt);
              }}
            >
              {entry !== null ? (
                <ProjectFavicon
                  project={entry.targetProject}
                  className="size-4 shrink-0"
                  fallbackIcon={FolderIcon}
                />
              ) : (
                <Icon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
              <span className="shrink-0 text-muted-foreground/60 text-xs">{suggestion.meta}</span>
            </button>
          );
        })}
      </Card>
    );

  if (!unassigned) {
    return suggestionCard === null ? null : (
      <div data-fork-draft-launchpad="">{suggestionCard}</div>
    );
  }
  return (
    <div
      data-fork-draft-launchpad=""
      className={
        suggestionCard === null
          ? undefined
          : "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-2 max-sm:grid-cols-1"
      }
    >
      <ProjectList choices={choices} recent={recent} />
      {suggestionCard}
    </div>
  );
}

/** Room the open list leaves below it: the toggle row, the card's padding and a gutter. */
const OPEN_LIST_BOTTOM_RESERVE = 64;

/** Projects with recent sidebar activity, or the first pickable ones when none has any. */
function recentProjectRows(choices: DraftProjectChoices) {
  const recent = choices.recentEntries ?? [];
  return recent.length > 0 ? recent : choices.entries.slice(0, QUICK_PICK_LIMIT);
}

function ProjectList(props: {
  readonly choices: DraftProjectChoices;
  readonly recent: ReturnType<typeof recentProjectRows>;
}) {
  const { choices, recent } = props;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  // Expanded or searching, the list grows in place and scrolls inside whatever
  // height is left below it, so the panel never runs off the window.
  const [openMaxHeight, setOpenMaxHeight] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searching = query.trim().length > 0;
  const open = expanded || searching;

  // Measured each time the list opens, so a resize or a taller composer since the last open counts.
  const measureOpenHeight = () => {
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    setOpenMaxHeight(Math.max(128, window.innerHeight - top - OPEN_LIST_BOTTOM_RESERVE));
  };

  const recentKeys = new Set(recent.map((entry) => entry.group.projectKey));
  const allOrdered = [
    ...recent,
    ...choices.entries.filter((entry) => !recentKeys.has(entry.group.projectKey)),
  ];
  const needle = query.trim().toLowerCase();
  const rows = searching
    ? allOrdered.filter((entry) => entry.group.displayName.toLowerCase().includes(needle))
    : expanded
      ? allOrdered
      : recent;

  const toggle = () => {
    if (!expanded) measureOpenHeight();
    setExpanded(!expanded);
  };

  const search = (
    <label className="flex h-9 min-w-0 cursor-text items-center gap-2 border-border border-b px-3 text-muted-foreground/70">
      <SearchIcon className="size-3.5 shrink-0" />
      <input
        type="text"
        value={query}
        placeholder="Search projects"
        aria-label="Search projects"
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-foreground text-xs outline-none placeholder:font-medium placeholder:text-muted-foreground/70"
        onChange={(event) => {
          if (!open) measureOpenHeight();
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && rows[0]) {
            event.preventDefault();
            choices.pick(rows[0].group.projectKey, event.currentTarget);
          } else if (event.key === "Escape" && query.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
          }
        }}
      />
    </label>
  );

  return (
    <Card header={search}>
      <div
        ref={listRef}
        className="min-h-0 overflow-y-auto overscroll-contain"
        style={open && openMaxHeight !== null ? { maxHeight: openMaxHeight } : undefined}
      >
        {rows.map((entry) => (
          <button
            key={entry.group.projectKey}
            type="button"
            className={ROW_CLASS_NAME}
            onClick={(event) => choices.pick(entry.group.projectKey, event.currentTarget)}
          >
            <ProjectFavicon
              project={entry.targetProject}
              className="size-4 shrink-0"
              fallbackIcon={FolderIcon}
            />
            <span className="min-w-0 flex-1 truncate">{entry.group.displayName}</span>
          </button>
        ))}
        {searching && rows.length === 0 ? (
          <div className="flex h-8 items-center px-2 text-muted-foreground/70 text-sm">
            No matching projects
          </div>
        ) : null}
        {!searching && choices.noProjectEnvironmentId !== null ? (
          <button
            type="button"
            className={ROW_CLASS_NAME}
            onClick={(event) => choices.pick(NO_PROJECT_VALUE, event.currentTarget)}
          >
            <MessageSquareDashedIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">No project</span>
          </button>
        ) : null}
        {open ? (
          <button
            type="button"
            className={`${ROW_CLASS_NAME} text-muted-foreground`}
            onClick={openAddProject}
          >
            <FolderPlusIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">Add a project</span>
          </button>
        ) : null}
      </div>
      {searching ? null : (
        <>
          {/* The divider spans the card edge to edge, past the list padding. */}
          {expanded ? <div className="-mx-1 my-1 border-border border-t" /> : null}
          <button
            type="button"
            aria-expanded={expanded}
            className={`${ROW_CLASS_NAME} text-muted-foreground`}
            onClick={toggle}
          >
            {expanded ? (
              <ChevronUpIcon className="size-4 shrink-0 opacity-60" />
            ) : (
              <ChevronDownIcon className="size-4 shrink-0 opacity-60" />
            )}
            <span className="min-w-0 flex-1 truncate">
              {expanded ? "Fewer projects" : `All projects (${choices.entries.length})`}
            </span>
          </button>
        </>
      )}
    </Card>
  );
}
