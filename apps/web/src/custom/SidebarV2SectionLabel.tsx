/**
 * A sidebar section's label and fold caret — the Bots and Threads rows (`fork-bots`) and the
 * status section headers (`sidebar-v2-status-grouping`) share them.
 */
import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/utils";

/** The filled caret: down while its section is folded, up while it is open. */
export function SidebarV2SectionCaret({
  collapsed,
  className,
  ...props
}: Omit<ComponentProps<"svg">, "children"> & { readonly collapsed: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 14 14"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinejoin="round"
      {...props}
      className={cn(className, !collapsed && "rotate-180")}
    >
      {/* An 11 x 5.5 caret, inset half the stroke so the round joins soften
          the corners without growing it. Centred on the box, so the 180°
          flip stays in place. */}
      <path d="M2.71 4.75H11.29L7 9.04Z" />
    </svg>
  );
}

/** A section's label, 13px semibold like the status headers under it. With `onToggle` it folds
    its section: the label, an optional count, and the caret, shown on hover or while folded. */
export function SidebarV2SectionLabel(props: {
  readonly count?: number;
  readonly collapsed?: boolean;
  readonly onToggle?: (() => void) | undefined;
  readonly testId: string;
  readonly children: ReactNode;
}) {
  const className = "text-[0.8125rem] leading-4 font-semibold text-muted-foreground";
  if (props.onToggle === undefined) {
    return <span className={className}>{props.children}</span>;
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
      {props.count === undefined ? null : (
        <span className="shrink-0 text-muted-foreground/60 tabular-nums">{props.count}</span>
      )}
      <SidebarV2SectionCaret
        collapsed={props.collapsed === true}
        className={cn(
          "size-3.5 shrink-0 opacity-0 transition-[opacity,rotate] group-hover/section:opacity-100 group-focus-visible/section:opacity-100",
          props.collapsed === true && "opacity-100",
        )}
      />
    </button>
  );
}
