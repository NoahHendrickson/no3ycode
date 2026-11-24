/**
 * A subagent thread link in an assistant message as a neutral capsule with the sidebar's status
 * mark — see `.fork/customizations.yaml#no3y-subagent-link-chip`. A live child is always in the
 * shell; an idle one is left out of it, so its row comes from one read of the message's thread
 * family.
 */
import { useAtomValue } from "@effect/atom-react";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  presentThreadShell,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import { selectEnvironmentQueryData } from "@t3tools/client-runtime/state/runtime";
import {
  isLiveSubagentShell,
  type EnvironmentId,
  type ScopedThreadRef,
  type ThreadId,
} from "@t3tools/contracts";
import {
  hasThreadLinks,
  parseThreadLinkHref,
  threadLinkCandidates,
} from "@t3tools/shared/threadLinks";
import { Link } from "@tanstack/react-router";
import * as Equal from "effect/Equal";
import { Atom } from "effect/reactivity";
import { useGT } from "gt-react";
import { createContext, use, useEffect, type ReactNode } from "react";

import { ContextChip, ContextChipLabel } from "~/components/ContextChip";
import { ThreadChipHoverCard } from "~/components/ThreadChipHoverCard";
import { ThreadHoverCardPopup } from "~/components/ThreadHoverCard";
import { Tooltip, TooltipTrigger } from "~/components/ui/tooltip";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useProject } from "~/state/entities";
import { environmentShell } from "~/state/shell";
import { environmentThreadShells, threadFamilies } from "~/state/threads";
import {
  dropPeriodAfterSubagentLinks,
  forkSubagentLinkHrefs,
  forkSubagentLinkKind,
  forkSubagentLinkLabel,
  isForkSubagentLinkThread,
  type ForkSubagentLinkKind,
} from "./forkSubagentLinkLogic";
import { sidebarV2CardTopStatus } from "./sidebarV2CardStatus";
import {
  SidebarV2StatusMark,
  SidebarV2StillMonitoringMark,
  SidebarV2StillWorkingMark,
} from "./SidebarV2StatusIndicator";

/** Provided around assistant messages only; everything else keeps upstream's thread chip. */
interface ForkSubagentLinkScopeValue {
  /** The thread the message is in; its family holds the idle children it links to. */
  readonly familyRef: ScopedThreadRef | null;
}

const ForkSubagentLinkScopeContext = createContext<ForkSubagentLinkScopeValue | null>(null);

export function ForkSubagentLinkScope(props: {
  readonly value: ForkSubagentLinkScopeValue | null;
  readonly children: ReactNode;
}) {
  return (
    <ForkSubagentLinkScopeContext value={props.value}>
      {props.children}
    </ForkSubagentLinkScopeContext>
  );
}

interface SubagentLink {
  readonly shell: EnvironmentThreadShell;
  readonly kind: ForkSubagentLinkKind | null;
  /** Empty for an untitled child; the chip falls back to the link's title. */
  readonly label: string;
  /** Set when the family read predates the child going idle; keyed by the stale row. */
  readonly staleKey: string | null;
}

const NO_HREFS: ReadonlyArray<string> = [];
const NO_HREFS_ATOM = Atom.make(NO_HREFS).pipe(Atom.withLabel("fork-subagent-link-hrefs:empty"));
const NO_LINK_ATOM = Atom.make<SubagentLink | null>(null).pipe(
  Atom.withLabel("fork-subagent-link:none"),
);
// A stale read is refreshed once per row snapshot, so a server that disagrees cannot loop.
const refreshedFamilies = new Set<string>();

const linkKey = (ref: ScopedThreadRef, familyRef: ScopedThreadRef | null) =>
  JSON.stringify([
    ref.environmentId,
    ref.threadId,
    familyRef?.environmentId === ref.environmentId ? familyRef.threadId : null,
  ]);

// Narrowed to one thread so shell deltas for other threads do not recompute the chip.
const removedSequenceAtom = Atom.family((key: string) => {
  const [environmentId, threadId] = JSON.parse(key) as [EnvironmentId, ThreadId];
  return Atom.make(
    (get) => get(environmentShell.stateValueAtom(environmentId)).removedAt.get(threadId) ?? -1,
  ).pipe(Atom.withLabel(`fork-subagent-link-removed:${key}`));
});

const subagentLinkAtom = Atom.family((key: string) => {
  const [environmentId, threadId, familyThreadId] = JSON.parse(key) as [
    EnvironmentId,
    ThreadId,
    ThreadId | null,
  ];
  return Atom.make((get): SubagentLink | null => {
    let shell = get(environmentThreadShells.quietThreadShellAtom({ environmentId, threadId }));
    let staleKey: string | null = null;
    if (shell === null && familyThreadId !== null) {
      const read = selectEnvironmentQueryData(
        get(threadFamilies.familyAtom(environmentId, familyThreadId)),
      );
      const row = read?.threads.find((thread) => thread.id === threadId);
      shell = row ? presentThreadShell(environmentId, row) : null;
      // The read predates the shell dropping the child (idle, archived), or the shell keeps every
      // live child, so a live row it lacks is older than the child idling.
      const removed = get(removedSequenceAtom(JSON.stringify([environmentId, threadId])));
      if (row && read && (removed > read.snapshotSequence || isLiveSubagentShell(row))) {
        staleKey = `${key}:${read.snapshotSequence}`;
      }
    }
    if (shell === null || !isForkSubagentLinkThread(shell)) return null;
    return {
      shell,
      kind: staleKey === null ? forkSubagentLinkKind(shell) : null,
      label: shell.title.trim() ? forkSubagentLinkLabel(shell.title) : "",
      staleKey,
    };
  }).pipe(Atom.withLabel(`fork-subagent-link:${key}`));
});

const subagentHrefsAtom = Atom.family((key: string) => {
  const [environmentId, familyRef, hrefs] = JSON.parse(key) as [
    EnvironmentId,
    ScopedThreadRef | null,
    ReadonlyArray<string>,
  ];
  return Atom.make((get): ReadonlyArray<string> =>
    hrefs.filter((href) => {
      const link = parseThreadLinkHref(href);
      if (!link) return false;
      const candidates = threadLinkCandidates(link, environmentId);
      const ref =
        candidates.find((candidate) =>
          get(environmentThreadShells.quietThreadShellAtom(candidate)),
        ) ?? candidates[0];
      return ref !== undefined && get(subagentLinkAtom(linkKey(ref, familyRef))) !== null;
    }),
  ).pipe(Atom.withEquality(Equal.equals), Atom.withLabel(`fork-subagent-link-hrefs:${key}`));
});

/** The message without the period that closes a line after a subagent chip. */
export function useForkSubagentLinkText(
  text: string,
  environmentId: EnvironmentId | null,
  streaming: boolean,
): string {
  const scope = use(ForkSubagentLinkScopeContext);
  const hrefs =
    scope !== null && environmentId !== null && hasThreadLinks(text)
      ? forkSubagentLinkHrefs(text)
      : NO_HREFS;
  const subagents = useAtomValue(
    hrefs.length === 0
      ? NO_HREFS_ATOM
      : subagentHrefsAtom(JSON.stringify([environmentId, scope?.familyRef ?? null, hrefs])),
  );
  return subagents.length === 0 ? text : dropPeriodAfterSubagentLinks(text, subagents, streaming);
}

/** The sidebar's marks, with its still glyphs for working and waiting: nothing moves inside a
    message. The link's accessible name carries the status, so the mark stays hidden.
    @public — Storybook draws it. */
export function SubagentLinkMark(props: {
  readonly kind: ForkSubagentLinkKind | null;
  readonly seed: string;
}) {
  return (
    <span aria-hidden className="inline-flex shrink-0">
      {props.kind === "working" ? (
        <SidebarV2StillWorkingMark />
      ) : props.kind === "waiting" ? (
        <SidebarV2StillMonitoringMark />
      ) : (
        <SidebarV2StatusMark
          status={sidebarV2CardTopStatus(props.kind, { goalActive: false })}
          seed={props.seed}
          idle="dot"
          celebrate={false}
        />
      )}
    </span>
  );
}

/** The capsule inside an assistant message, where every thread link takes it; else upstream's chip. */
export function useForkThreadLinkShape(): "capsule" | undefined {
  return use(ForkSubagentLinkScopeContext) === null ? undefined : "capsule";
}

/** Renders `children`, the upstream chip, unless the link names a subagent in an assistant message. */
export function ForkSubagentLinkChip(props: {
  readonly threadRef: ScopedThreadRef;
  /** Upstream's resolved title, for a child whose own title is empty. */
  readonly title: string;
  readonly copyMarkdown?: string | undefined;
  readonly children: ReactNode;
}) {
  const gt = useGT();
  const scope = use(ForkSubagentLinkScopeContext);
  const { environmentId, threadId } = props.threadRef;
  const key = linkKey(props.threadRef, scope?.familyRef ?? null);
  const link = useAtomValue(scope === null ? NO_LINK_ATOM : subagentLinkAtom(key));
  const staleKey = link?.staleKey ?? null;
  const familyRef = scope?.familyRef ?? null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- re-reads the server's thread family when its cached rows predate the child going idle
  useEffect(() => {
    if (staleKey === null || familyRef === null || refreshedFamilies.has(staleKey)) return;
    refreshedFamilies.add(staleKey);
    threadFamilies.refresh(appAtomRegistry, familyRef.environmentId, familyRef.threadId);
  }, [staleKey, familyRef]);
  const projectId = link?.shell.projectId ?? null;
  const project = useProject(projectId ? scopeProjectRef(environmentId, projectId) : null);
  if (link === null) return props.children;
  const status = statusLabel(link.kind, gt);
  const title = link.shell.title.trim() || props.title;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ContextChip
            render={
              <Link
                to="/$environmentId/$threadId"
                params={{ environmentId, threadId }}
                draggable={false}
              />
            }
            aria-label={gt("Thread, {title}", { title: `${title}, ${status}` })}
            data-markdown-copy={props.copyMarkdown}
            data-fork-subagent-link=""
            shape="capsule"
          >
            <SubagentLinkMark kind={link.kind} seed={key} />
            <ContextChipLabel>{link.label || props.title}</ContextChipLabel>
          </ContextChip>
        }
      />
      <ThreadHoverCardPopup side="top">
        <ThreadChipHoverCard
          title={title}
          project={project}
          shell={link.shell}
          unreadable={false}
        />
      </ThreadHoverCardPopup>
    </Tooltip>
  );
}

function statusLabel(kind: ForkSubagentLinkKind | null, gt: ReturnType<typeof useGT>): string {
  switch (kind) {
    case "working":
      return gt("Working");
    case "waiting":
      return gt("Waiting");
    case "approval":
      return gt("Needs approval");
    case "input":
      return gt("Needs your input");
    case "done":
      return gt("Completed");
    case "failed":
      return gt("Failed");
    case null:
      return gt("Idle");
  }
}
