/**
 * The pieces a compact thread card adds to its single line — see
 * `.fork/customizations.yaml#sidebar-v2-compact-cards`.
 *
 * A compact card is the full card's title line alone. What the repo line said
 * in words is reduced to marks that ride ahead of the trailing group: a cloud
 * when the agent runs on another machine, the terminal glyph, and the pull
 * request badge. The project, which the repo line names, leads the title as
 * its favicon instead (`SidebarV2CompactCardLead`). Names — project, branch,
 * model — are in the row's hover card, which every card already has.
 *
 * Laptop and the worktree/branch mark are not drawn: on one line a mark that
 * nearly every thread carries says nothing.
 *
 * Presentational only, with the PR badge and terminal glyph as slots, for the
 * same reason as `SidebarV2ThreadCardMeta`: no row state crosses the seam.
 */
import type { ReactNode } from "react";

import { ProjectFavicon, type ProjectFaviconProject } from "~/components/ProjectFavicon";

import { CloudIcon } from "./icons/lucide-phosphor";
import { SidebarV2ProjectFolderMark } from "./SidebarV2ThreadCardMeta";

export interface SidebarV2ThreadCardCompactMarksProps {
  readonly isRemote: boolean;
  /** Required slots, so a call site has to say `null` out loud — see
      `SidebarV2ThreadCardMetaProps.terminalSlot`. */
  readonly terminalSlot: ReactNode;
  readonly prSlot: ReactNode;
}

/** Every mark is the repo line's 12px. */
const MARK = "size-3 shrink-0";

export function SidebarV2ThreadCardCompactMarks(props: SidebarV2ThreadCardCompactMarksProps) {
  return (
    // data-fork-thread-card-meta: the same palette hook as the repo line, so
    // Glass inks these marks the way it inks the line they stand in for.
    <span
      data-testid="sidebar-v2-card-compact-marks"
      data-fork-thread-card-meta=""
      className="flex shrink-0 items-center gap-1.5 text-[0.75rem] leading-4 text-muted-foreground"
    >
      {props.isRemote ? (
        <>
          <span className="sr-only">Remote</span>
          <CloudIcon aria-hidden className={MARK} />
        </>
      ) : null}
      {props.terminalSlot ?? null}
      {props.prSlot ?? null}
    </span>
  );
}

/** The project favicon a compact card's title leads with, at 12px inside an
    18px tile as tall as the title line. The tile's foreground tint follows
    every palette, so any favicon sits on the same quiet ground. A
    favicon-less project draws upstream's title monogram, like the repo line;
    the folder mark stands in only for a thread whose project record has not
    landed yet. */
export function SidebarV2CompactCardLead(props: {
  readonly project: ProjectFaviconProject | null;
}) {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-foreground/[0.12]">
      {props.project ? (
        <ProjectFavicon project={props.project} className="size-3" />
      ) : (
        <SidebarV2ProjectFolderMark className="size-3 text-muted-foreground" />
      )}
    </span>
  );
}
