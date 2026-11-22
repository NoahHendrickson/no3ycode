/**
 * The fork's tabs, in the shape of the sidebar's Code / Chat switch: a track in the sidebar's
 * control surface with the chosen tab raised. IconTab holds one glyph; Tab sizes to its word.
 * Both glide between choices through SegmentedTabs. Basic draws them to Figma t3-fork 740:1163
 * (theme.custom.basic.css); the other themes keep their own dressing.
 */
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

import { SegmentedMenuTab, SegmentedMenuTabs, SegmentedTab, SegmentedTabs } from "./SegmentedTabs";

/** The strip's outer height: 28px at `sm`, 32px at `md`, 36px at `lg`. Tabs fill the track's
    inside, so a theme that insets its track (Basic, 2px) gets tabs that much smaller. */
export type TabsSize = "sm" | "md" | "lg";

const TRACK_HEIGHT = { sm: "h-7", md: "h-8", lg: "h-9" } as const satisfies Record<
  TabsSize,
  string
>;
const TRACK = "shrink-0 rounded-xl bg-sidebar-control-surface p-0 dark:bg-sidebar-control-surface";
const TAB =
  "h-full rounded-xl border border-transparent text-sidebar-muted-foreground hover:text-sidebar-foreground data-pressed:border-sidebar-border data-pressed:bg-sidebar data-pressed:text-sidebar-foreground dark:data-pressed:bg-sidebar dark:data-pressed:text-sidebar-foreground";
const ICON_TAB = `aspect-square px-0 ${TAB}`;
const WORD_TAB = `px-3 ${TAB}`;

/** Set on the track, so every tab in a strip matches. */
export function Tabs({
  className,
  size = "sm",
  ...props
}: ComponentProps<typeof SegmentedTabs> & { readonly size?: TabsSize }) {
  return <SegmentedTabs {...props} className={cn(TRACK, TRACK_HEIGHT[size], className)} />;
}

export function Tab({ className, ...props }: ComponentProps<typeof SegmentedTab>) {
  return <SegmentedTab data-fork-tab="word" {...props} className={cn(WORD_TAB, className)} />;
}

/** A glyph alone, so it needs the name a screen reader reads (and a tooltip for sighted users). */
export function IconTab({
  className,
  ...props
}: ComponentProps<typeof SegmentedTab> & { readonly "aria-label": string }) {
  return <SegmentedTab data-fork-tab="icon" {...props} className={cn(ICON_TAB, className)} />;
}

/** Icon tabs inside a menu (the Threads menu's Group by): its items join the menu's keyboard
    navigation. The shape is the switch's at `sm`, with the pick cut from the menu's own surface
    and the track showing through its border; Basic draws every strip alike. */
export function MenuTabs({
  className,
  size = "sm",
  ...props
}: ComponentProps<typeof SegmentedMenuTabs> & { readonly size?: TabsSize }) {
  return <SegmentedMenuTabs {...props} className={cn(TRACK, TRACK_HEIGHT[size], className)} />;
}

export function MenuIconTab({
  className,
  ...props
}: ComponentProps<typeof SegmentedMenuTab> & { readonly "aria-label": string }) {
  return (
    <SegmentedMenuTab
      data-fork-tab="icon"
      {...props}
      className={cn(
        ICON_TAB,
        "data-highlighted:text-sidebar-foreground data-pressed:border-transparent data-pressed:bg-popover data-pressed:bg-clip-padding dark:data-pressed:bg-popover",
        className,
      )}
    />
  );
}
