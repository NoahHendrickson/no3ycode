/** MOCKUP: the New agent draft's launchpad under the centred composer. An
    unassigned draft lists its recent projects; either state lists suggested
    new work that fills the composer. Suggestions are placeholder data. */
import { type ReactNode, useRef, useState } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { useComposerDraftStore } from "~/composerDraftStore";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FolderPlusIcon,
  CircleXIcon,
  EyeIcon,
  FolderIcon,
  GitCommitIcon,
  GitMergeIcon,
  MessageSquareDashedIcon,
  SearchIcon,
  Trash2Icon,
  CloudDownloadIcon,
} from "./icons/lucide-hugeicons";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  useDraftProjectChoices,
  type DraftProjectChoices,
} from "./useDraftProjectChoices";

type SuggestionKind = "checks" | "review" | "conflicts" | "commit" | "pull" | "cleanup";

interface Suggestion {
  readonly id: string;
  readonly kind: SuggestionKind;
  readonly title: string;
  readonly meta: string;
  readonly prompt: string;
}

const KIND_ICON: Record<SuggestionKind, typeof CircleXIcon> = {
  checks: CircleXIcon,
  review: EyeIcon,
  conflicts: GitMergeIcon,
  commit: GitCommitIcon,
  pull: CloudDownloadIcon,
  cleanup: Trash2Icon,
};

const PLACEHOLDER_ACROSS_PROJECTS: readonly Suggestion[] = [
  {
    id: "checks-382",
    kind: "checks",
    title: "Fix the failing checks on #382",
    meta: "Checks failing",
    prompt:
      "Fix the failing CI checks on PR #382. Pull the failing job logs, find the root cause, and push a fix to the PR branch.",
  },
  {
    id: "review-391",
    kind: "review",
    title: "Review #391 · Mobile sheet drag handle",
    meta: "Review requested",
    prompt:
      "Review PR #391. Read the diff and the review guide, then leave a summary of real issues ranked by severity.",
  },
  {
    id: "conflicts-377",
    kind: "conflicts",
    title: "Resolve conflicts on #377",
    meta: "Conflicts",
    prompt:
      "PR #377 conflicts with its base. Rebase it, resolve the conflicts, run the affected tests, and push.",
  },
  {
    id: "cleanup",
    kind: "cleanup",
    title: "Clean up 3 worktrees whose PRs merged",
    meta: "Cleanup",
    prompt:
      "List the worktrees whose pull requests have merged, confirm none has uncommitted work, and remove them.",
  },
];

const PLACEHOLDER_IN_PROJECT: readonly Suggestion[] = [
  PLACEHOLDER_ACROSS_PROJECTS[0]!,
  PLACEHOLDER_ACROSS_PROJECTS[1]!,
  {
    id: "commit",
    kind: "commit",
    title: "Commit the 6 uncommitted changes",
    meta: "Working tree",
    prompt:
      "Look at the uncommitted changes in this checkout, group them into sensible commits, and commit them.",
  },
  {
    id: "pull",
    kind: "pull",
    title: "Pull the 3 new commits on custom",
    meta: "Behind",
    prompt: "Pull the latest commits on custom into this checkout and tell me what changed.",
  },
];

const ROW_CLASS_NAME =
  "flex h-8 w-full min-w-0 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-left text-foreground text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground";

/** Rows the project column shows before "All projects"; the composer is centred, so the
    panel below it has roughly half a window to fit in. */
const PROJECT_ROW_LIMIT = 4;

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

export function DraftLaunchpad(props: Parameters<typeof useDraftProjectChoices>[0]) {
  const choices = useDraftProjectChoices(props);
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const { draftId } = props;
  if (draftId === null) return null;
  if (choices.entries.length === 0 && choices.noProjectEnvironmentId === null) return null;
  // "No project" is a chat with no repository; there is no project work to suggest.
  if (choices.selection.kind === "no-project") return null;

  const unassigned = choices.selection.kind === "unassigned";
  const recent = recentProjectRows(choices);

  const start = (suggestion: Suggestion, projectKey: string | null) => {
    if (projectKey !== null) choices.pick(projectKey);
    setPrompt(draftId, suggestion.prompt);
  };

  if (!unassigned) {
    return (
      <div data-fork-draft-launchpad="">
        <Card label="Start something new">
          {PLACEHOLDER_IN_PROJECT.map((suggestion) => {
            const Icon = KIND_ICON[suggestion.kind];
            return (
              <button
                key={suggestion.id}
                type="button"
                className={ROW_CLASS_NAME}
                onClick={() => start(suggestion, null)}
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
                <span className="shrink-0 text-muted-foreground/60 text-xs">{suggestion.meta}</span>
              </button>
            );
          })}
        </Card>
      </div>
    );
  }

  // Unassigned: where to work on the left, what to work on (anywhere) on the right.
  // Each suggestion leads with its project's icon, since picking it picks that project.
  return (
    <div
      data-fork-draft-launchpad=""
      className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-2 max-sm:grid-cols-1"
    >
      <ProjectList choices={choices} />
      <Card label="Start something new">
        {PLACEHOLDER_ACROSS_PROJECTS.map((suggestion, index) => {
          const entry = recent.length > 0 ? recent[index % recent.length]! : null;
          return (
            <button
              key={suggestion.id}
              type="button"
              className={ROW_CLASS_NAME}
              onClick={() => start(suggestion, entry?.group.projectKey ?? null)}
            >
              {entry ? (
                <ProjectFavicon
                  project={entry.targetProject}
                  className="size-4 shrink-0"
                  fallbackIcon={FolderIcon}
                />
              ) : (
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
              <span className="shrink-0 text-muted-foreground/60 text-xs">{suggestion.meta}</span>
            </button>
          );
        })}
      </Card>
    </div>
  );
}

/** Room the open list leaves below it: the toggle row, the card's padding and a gutter. */
const OPEN_LIST_BOTTOM_RESERVE = 64;

/** Projects with recent sidebar activity, or the first pickable ones when none has any. */
function recentProjectRows(choices: DraftProjectChoices) {
  const recent = choices.recentEntries ?? [];
  return (recent.length > 0 ? recent : choices.entries).slice(0, PROJECT_ROW_LIMIT);
}

function ProjectList(props: { readonly choices: DraftProjectChoices }) {
  const { choices } = props;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  // Expanded or searching, the list grows in place and scrolls inside whatever
  // height is left below it, so the panel never runs off the window.
  const [openMaxHeight, setOpenMaxHeight] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searching = query.trim().length > 0;
  const open = expanded || searching;

  const measureOpenHeight = () => {
    if (openMaxHeight !== null) return;
    const top = listRef.current?.getBoundingClientRect().top ?? 0;
    setOpenMaxHeight(Math.max(128, window.innerHeight - top - OPEN_LIST_BOTTOM_RESERVE));
  };

  const recent = recentProjectRows(choices);
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
          measureOpenHeight();
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && rows[0]) {
            event.preventDefault();
            choices.pick(rows[0].group.projectKey);
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
            onClick={() => choices.pick(entry.group.projectKey)}
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
            onClick={() => choices.pick(NO_PROJECT_VALUE)}
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
