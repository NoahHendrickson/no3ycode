/** The New agent draft's launchpad under the centred composer: the projects to
    pick from while the draft has none, and new work drawn from open pull
    requests and the checkout's git status. See
    `.fork/customizations.yaml#fork-draft-project-quick-picks`. */
import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, PullRequestListInput, ScopedProjectRef } from "@t3tools/contracts";
import * as Equal from "effect/Equal";
import { AsyncResult, Atom } from "effect/reactivity";
import { type ReactNode, useLayoutEffect, useState } from "react";

import { ProjectFavicon } from "~/components/ProjectFavicon";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { observeResize } from "~/lib/observeResize";
import { usePullRequestList } from "~/state/pullRequests";
import { vcsEnvironment } from "~/state/vcs";
import {
  deriveLaunchpadSuggestions,
  type LaunchpadCheckout,
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
  PlayIcon,
  SearchIcon,
} from "./icons/lucide-hugeicons";
import {
  NO_PROJECT_VALUE,
  openAddProject,
  QUICK_PICK_LIMIT,
  SHORT_WINDOW_QUERY,
  useDraftProjectChoices,
  type DraftProjectChoices,
} from "./useDraftProjectChoices";
import { isChatDraft } from "./chatMode";

const KIND_ICON: Record<LaunchpadSuggestionKind, typeof CircleXIcon> = {
  conflicts: CircleAlertIcon,
  checks: CircleXIcon,
  changes: PenLineIcon,
  review: EyeIcon,
  commit: GitCommitIcon,
  pull: CloudDownloadIcon,
  "open-pr": GitPullRequestArrowIcon,
  merge: GitMergeIcon,
  "review-open": EyeIcon,
  "dev-server": PlayIcon,
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
/** Where a checkout lives: all its git status query needs. */
interface CheckoutLocation {
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
}

/** The statuses of a list of checkouts, in order (null where a folder is not a repository).
    Keyed by their locations alone, so one list of checkouts is one atom across renders. */
const checkoutStatusesAtom = Atom.family((key: string) => {
  const locations: ReadonlyArray<CheckoutLocation> = JSON.parse(key);
  return Atom.make((get) =>
    locations.map(({ environmentId, cwd }) =>
      get(launchpadGitStatusAtom(vcsEnvironment.status({ environmentId, input: { cwd } }))),
    ),
  ).pipe(Atom.withEquality(Equal.equals));
});

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
    <div
      data-fork-draft-launchpad-card=""
      // Rounds with the composer above it, not the 8px cards beside a thread (--fork-card-radius).
      className="flex min-w-0 flex-col overflow-hidden rounded-(--fork-composer-radius) border border-border bg-card pb-1"
    >
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
    readonly checkout: CheckoutLocation | null;
    /** A multi-model send makes fresh worktrees, so no checkout's work has anywhere to run. */
    readonly multiModel: boolean;
  },
) {
  const choices = useDraftProjectChoices(props);
  const setPrompt = useComposerDraftStore((store) => store.setPrompt);
  const shortWindow = useMediaQuery(SHORT_WINDOW_QUERY);
  const { draftId } = props;
  // No repository yet: the launchpad offers the projects and their work, and a pick moves the draft.
  const { needsProject } = choices;
  const isChat = useComposerDraftStore((store) =>
    draftId === null ? false : isChatDraft(store.getDraftSession(draftId)),
  );
  const recent = recentProjectRows(choices);
  // Decided before the queries, so a hidden launchpad (a short window or a Chat mode
  // draft) never asks the server for pull requests or git status.
  const shown =
    draftId !== null &&
    !shortWindow &&
    !isChat &&
    (choices.entries.length > 0 || choices.noProjectEnvironmentId !== null);
  // Only the copy a pick runs on (the draft's machine), so the forge account that
  // lists "your" pull requests is the one the task will run under.
  const projectRefs: ScopedProjectRef[] = !shown
    ? []
    : needsProject
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
  // The checkouts whose git work to offer: with no project yet, each recent project's own (a
  // pick moves the draft into it); otherwise the picked project's, which a pending pick has
  // not reached yet.
  const checkoutOwners: ReadonlyArray<CheckoutLocation & Omit<LaunchpadCheckout, "git">> =
    !shown || props.multiModel
      ? []
      : needsProject
        ? recent.map((entry) => ({
            environmentId: entry.targetProject.environmentId,
            cwd: entry.targetProject.workspaceRoot,
            project: {
              environmentId: entry.targetProject.environmentId,
              projectId: entry.targetProject.id,
            },
            name: entry.group.displayName,
          }))
        : props.checkout === null || choices.pending
          ? []
          : [{ ...props.checkout, project: null, name: null }];
  const statuses = useAtomValue(
    checkoutStatusesAtom(
      JSON.stringify(
        checkoutOwners.map(({ environmentId, cwd }): CheckoutLocation => ({ environmentId, cwd })),
      ),
    ),
  );

  if (!shown || draftId === null) return null;

  const suggestions = deriveLaunchpadSuggestions({
    authored: authored.data?.entries ?? [],
    reviewing: reviewing.data?.entries ?? [],
    checkouts: checkoutOwners.flatMap(({ project, name }, index) => {
      const git = statuses[index] ?? null;
      return git === null ? [] : [{ project, name, git }];
    }),
    // Its own checkout, like the git work: a fresh worktree has nothing installed to serve.
    offerDevServer:
      !needsProject && !choices.pending && props.checkout !== null && !props.multiModel,
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

  // With no project yet the suggestions span projects, so each leads with its project's
  // icon and picking one picks that project; one whose project isn't pickable is left out.
  const rows = suggestions
    .map((suggestion) => ({
      suggestion,
      entry: needsProject ? entryFor(suggestion.project) : null,
    }))
    .filter((row) => !needsProject || row.entry !== null);
  const suggestionCard =
    rows.length === 0 ? null : (
      <Card label="Start something new">
        {rows.map(({ suggestion, entry }) => {
          const Icon = KIND_ICON[suggestion.kind];
          return (
            <button
              key={suggestion.id}
              type="button"
              className={ROW_CLASS_NAME}
              onClick={(event) => {
                if (entry !== null) {
                  choices.pick(
                    entry.group.projectKey,
                    event.currentTarget,
                    suggestion.envMode === null ? undefined : { envMode: suggestion.envMode },
                  );
                }
                // A draft can already hold what the user wrote before picking.
                const written =
                  useComposerDraftStore.getState().getComposerDraft(draftId)?.prompt ?? "";
                if (written.includes(suggestion.prompt)) return;
                setPrompt(
                  draftId,
                  written.trim().length > 0
                    ? `${written}\n\n${suggestion.prompt}`
                    : suggestion.prompt,
                );
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
            </button>
          );
        })}
      </Card>
    );

  if (!needsProject) {
    return suggestionCard === null ? null : <LaunchpadRoot>{suggestionCard}</LaunchpadRoot>;
  }
  return (
    <LaunchpadRoot
      className={
        suggestionCard === null
          ? undefined
          : "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-2 max-sm:grid-cols-1"
      }
    >
      <ProjectList choices={choices} recent={recent} />
      {suggestionCard}
    </LaunchpadRoot>
  );
}

/**
 * The launchpad scrolls inside the room left between it and the chat canvas's
 * bottom edge (above any terminal drawer), so a tall list or a phone's stacked
 * cards never run off screen or under the drawer.
 */
function LaunchpadRoot(props: {
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tracks the window and the composer above, which move the room below
  useLayoutEffect(() => {
    if (root === null) return;
    const canvas = root.closest("[data-chat-canvas]");
    const measure = () => {
      const bottom = canvas?.getBoundingClientRect().bottom ?? window.innerHeight;
      setMaxHeight(Math.max(96, Math.floor(bottom - root.getBoundingClientRect().top - 16)));
    };
    // The composer above grows as the user writes, a notice can appear above the
    // launchpad in its slot, and a terminal drawer shortens the canvas.
    const stopObserving = observeResize(
      [
        root.closest("[data-chat-composer-stack]") ?? document.documentElement,
        ...(root.parentElement ? [root.parentElement] : []),
        ...(canvas ? [canvas] : []),
      ],
      measure,
    );
    window.addEventListener("resize", measure);
    measure();
    return () => {
      stopObserving();
      window.removeEventListener("resize", measure);
    };
  }, [root]);
  return (
    <div
      ref={setRoot}
      data-fork-draft-launchpad=""
      className={`overflow-y-auto overscroll-contain ${props.className ?? ""}`}
      style={maxHeight === null ? undefined : { maxHeight }}
    >
      {props.children}
    </div>
  );
}

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
  // Expanded or searching, the list grows in place; LaunchpadRoot scrolls it.
  const searching = query.trim().length > 0;
  const open = expanded || searching;

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

  const toggle = () => setExpanded(!expanded);
  // With every project already listed, there is nothing to expand to.
  const hasMore = choices.entries.length > recent.length;

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
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && searching && rows[0]) {
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
      <div>
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
        {open || !hasMore ? (
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
      {searching || !hasMore ? null : (
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
