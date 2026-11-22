/**
 * The header above each status section — see
 * `.fork/customizations.yaml#sidebar-v2-status-grouping`.
 *
 * A quiet 32px row carrying the section label (13px semibold on the muted
 * channel) with its filled fold caret right beside it, and the list's trailing
 * controls (add project, sort, view settings) revealed on hover/focus or while
 * one of their menus is open (`theme.custom.css` carries the reveal rules).
 *
 * The pinned block takes the same header while status grouping is on, and the
 * settled tail takes it in every grouping, so every group in the list reads the
 * same way; `section` is "pinned" or "settled" there.
 */
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "~/lib/utils";

import { SIDEBAR_V2_CARD_ALIGNMENT } from "./sidebarV2CardAlignment";
import { SidebarV2SectionCaret } from "./SidebarV2SectionLabel";
import { SIDEBAR_V2_TRAILING_OFFSET } from "./sidebarV2TrailingColumn";
import {
  SIDEBAR_V2_STATUS_SECTION_LABELS,
  type SidebarV2StatusHeaderKey,
} from "./sidebarV2StatusGrouping";

export function SidebarV2StatusSectionHeader(props: {
  readonly section: SidebarV2StatusHeaderKey;
  readonly isFirst: boolean;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  /** Trailing list controls (add project, sort, view settings), revealed on
      hover/focus or while a menu is open. */
  readonly renderTrailing?: ((onMenuOpenChange: (open: boolean) => void) => ReactNode) | undefined;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li
      data-thread-selection-safe
      data-fork-status-section-header=""
      className={cn(
        "flex h-8 w-full list-none items-center gap-1.5",
        SIDEBAR_V2_CARD_ALIGNMENT.cardPad,
        // The row is h-8 (8px above the 16px label), so mt-2 on top of the 2px
        // list gap puts 18px from the previous card's bottom edge to the label.
        props.isFirst ? "mt-0" : "mt-2",
        SIDEBAR_V2_CARD_ALIGNMENT.headerTrail,
      )}
    >
      <button
        type="button"
        onClick={props.onToggleCollapsed}
        aria-expanded={!props.collapsed}
        data-testid="sidebar-v2-status-section-toggle"
        data-status={props.section}
        className="inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left text-[0.75rem] leading-4 font-medium text-muted-foreground hover:text-sidebar-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
      >
        <span className="truncate">{SIDEBAR_V2_STATUS_SECTION_LABELS[props.section]}</span>
        <SidebarV2SectionCaret
          data-fork-status-section-caret=""
          collapsed={props.collapsed}
          className="size-3.5 shrink-0"
        />
      </button>
      {props.renderTrailing ? (
        <span
          data-fork-section-actions=""
          data-fork-menu-open={menuOpen ? "" : undefined}
          className={cn("-me-3 flex shrink-0 items-center", SIDEBAR_V2_TRAILING_OFFSET.headerPlus)}
        >
          {props.renderTrailing(setMenuOpen)}
        </span>
      ) : null}
    </li>
  );
}
