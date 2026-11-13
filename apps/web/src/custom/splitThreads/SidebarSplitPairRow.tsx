/**
 * A split pair's sidebar row: its two cards side by side, one item with a
 * divider between them — see `.fork/customizations.yaml#fork-split-threads`.
 */
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";

export function SidebarSplitPairRow(props: {
  /** Under a project header: joins the header's run of cards (hover reveal, drop edge). */
  readonly projectSection: boolean;
  /** Compact cards are pills, so the pair's fill is one too. */
  readonly compact: boolean;
  /** One of the pair holds the route: the pair wears the open fill for both cards. */
  readonly active: boolean;
  readonly children: ReactNode;
}) {
  return (
    <li
      className="relative list-none"
      data-fork-split-pair=""
      data-active={props.active ? "true" : undefined}
      data-fork-project-section={props.projectSection ? "" : undefined}
    >
      <ul
        role="presentation"
        className={cn(
          "grid grid-cols-2",
          SIDEBAR_V2_CARD_ALIGNMENT.listGap,
          props.compact ? "rounded-full" : "rounded-[16px]",
          props.active &&
            "bg-sidebar-row-active light:ring-1 light:ring-inset light:ring-sidebar-border/70",
        )}
      >
        {props.children}
      </ul>
      <span
        aria-hidden
        data-fork-split-pair-divider=""
        className="pointer-events-none absolute inset-y-[28%] left-1/2 w-px -translate-x-1/2 bg-current opacity-15"
      />
    </li>
  );
}
