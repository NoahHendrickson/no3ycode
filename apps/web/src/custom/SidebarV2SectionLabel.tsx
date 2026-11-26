/**
 * A sidebar section's label and fold caret — the Bots and Threads rows (`fork-bots`) and the
 * status section headers (`sidebar-v2-status-grouping`) share them.
 */
import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/utils";

/** The filled chevron: down while its section is open, right while it is folded. */
export function SidebarV2SectionCaret({
  collapsed,
  className,
  ...props
}: Omit<ComponentProps<"svg">, "children"> & { readonly collapsed: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      fill="none"
      {...props}
      className={cn("transition-transform duration-150", className, collapsed && "-rotate-90")}
    >
      <path
        d="M7 8.75C7.92231 8.75 10.5 5.25003 10.5 5.25003L3.5 5.25C3.50854 5.26159 6.07917 8.75 7 8.75Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={0.875}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A section's label, regular and 1px under the Sidebar font size like the status headers under it. With `onToggle` it folds
    its section: the label and the always-visible chevron. */
export function SidebarV2SectionLabel(props: {
  readonly collapsed?: boolean;
  readonly onToggle?: (() => void) | undefined;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  const className = "text-sidebar-label font-normal text-muted-foreground";
  if (props.onToggle === undefined) {
    return (
      <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
        <span className="truncate">{props.children}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onToggle}
      aria-expanded={props.collapsed !== true}
      data-testid={props.testId}
      className={cn(
        "group/section inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-sm text-left hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
    >
      <span className="truncate">{props.children}</span>
      <SidebarV2SectionCaret collapsed={props.collapsed === true} className="size-3.5 shrink-0" />
    </button>
  );
}
