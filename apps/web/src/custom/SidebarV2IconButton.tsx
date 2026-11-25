/**
 * The thread list's icon-only controls — see
 * `.fork/customizations.yaml#sidebar-v2-row-action-hit-area`.
 */
import { type ComponentProps, cloneElement, type ReactElement } from "react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { SIDEBAR_V2_SLIM_ROW_ACTION_CLASS } from "./sidebarV2TrailingColumn";

const BOX = {
  // Button's icon sizes grow below sm; the trailing column's offsets are derived from fixed boxes.
  row: { size: "icon-xs", className: "size-6" },
  header: { size: "icon", className: "size-8 rounded-[10px]" },
  tab: { size: "icon-micro", className: "size-5 rounded-full" },
} as const;

/** The Storybook Button, ghost-muted, at the list's fixed boxes: a 24px row action, a header's
    32px ⋯ and + (with the header's 10px corners), or a collapsed tab's round 20px action. */
export function SidebarV2IconButton({
  box = "row",
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  readonly box?: keyof typeof BOX;
}) {
  return (
    <Button
      // A foreground tint, not accent: accent is the row's own hover or selected fill in some
      // themes, and the target's edge would vanish on it.
      variant="ghost-tint"
      size={BOX[box].size}
      className={cn(
        BOX[box].className,
        // Mounted hidden on every row of an unvirtualized list; a compositor layer each is the
        // cost, and the press scale runs without one.
        "[&:not([aria-haspopup]):not(:disabled):not([aria-disabled=true])]:will-change-auto",
        className,
      )}
      {...props}
    />
  );
}

/** A slim row's one hover action (settle, un-settle or wake), placed over the time label it swaps
    with and revealed with the row. */
export function SidebarV2SlimRowAction(props: {
  readonly label: string;
  readonly icon: ReactElement;
  readonly onClick: ComponentProps<typeof Button>["onClick"];
  readonly onPointerDown: ComponentProps<typeof Button>["onPointerDown"];
  /** Names the action on hover too, where its glyph alone is less familiar. */
  readonly tooltip?: boolean;
}) {
  const button = (
    <SidebarV2IconButton
      aria-label={props.label}
      onClick={props.onClick}
      onPointerDown={props.onPointerDown}
      className={SIDEBAR_V2_SLIM_ROW_ACTION_CLASS}
    />
  );
  if (!props.tooltip) return cloneElement(button, undefined, props.icon);
  // No children on the render element: the trigger's own children (the icon) must win the merge.
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{props.icon}</TooltipTrigger>
      <TooltipPopup side="top">{props.label}</TooltipPopup>
    </Tooltip>
  );
}
