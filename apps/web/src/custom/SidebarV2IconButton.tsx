/**
 * The thread list's icon-only controls — see
 * `.fork/customizations.yaml#sidebar-v2-row-action-hit-area`.
 */
import { type ComponentProps, cloneElement, type ReactElement } from "react";

import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { SIDEBAR_V2_SLIM_ROW_ACTION_CLASS } from "./sidebarV2TrailingColumn";

/** The Storybook Button, ghost-muted, pinned to the trailing column's fixed boxes at every width:
    24px for a row action, 32px for a header's ⋯ and + (with the header's 10px corners). Button's
    own icon sizes grow below sm, and the column's offsets are derived from these two boxes. */
export function SidebarV2IconButton({
  box = "row",
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  readonly box?: "row" | "header";
}) {
  return (
    <Button
      variant="ghost-muted"
      size={box === "header" ? "icon" : "icon-xs"}
      className={cn(box === "header" ? "size-8 rounded-[10px]" : "size-6", className)}
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
