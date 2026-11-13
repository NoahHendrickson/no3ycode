/**
 * A split pair's sidebar row: its two cards side by side, one item with a
 * divider between them — see `.fork/customizations.yaml#fork-split-threads`.
 */
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { SIDEBAR_V2_CARD_ALIGNMENT } from "../sidebarV2CardAlignment";
import { threadRowOpenSurfaceClassName, type ThreadRowShape } from "../sidebarV2RowPolicy";

export function SidebarSplitPairRow(props: {
  /** Under a project header: joins the header's run of cards (hover reveal, drop edge). */
  readonly projectSection: boolean;
  /** Its cards' shape, which the pair's fill takes. */
  readonly shape: ThreadRowShape;
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
          props.active && threadRowOpenSurfaceClassName(props.shape),
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
