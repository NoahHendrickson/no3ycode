/**
 * The fork's tabs, in the shape of the sidebar's Code / Chat switch: a track in the sidebar's
 * control surface with the chosen tab raised. IconTab holds one glyph; Tab sizes to its word.
 * Both glide between choices through SegmentedTabs. Basic draws them to Figma t3-fork 740:1163
 * (theme.custom.basic.css); the other themes keep their own dressing.
 */
import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

import { SegmentedTab, SegmentedTabs } from "./SegmentedTabs";

export const TABS_TRACK =
  "h-7 shrink-0 rounded-xl bg-sidebar-control-surface p-0 dark:bg-sidebar-control-surface";
const TAB =
  "h-7 rounded-xl border border-transparent text-sidebar-muted-foreground hover:text-sidebar-foreground data-pressed:border-sidebar-border data-pressed:bg-sidebar data-pressed:text-sidebar-foreground dark:data-pressed:bg-sidebar dark:data-pressed:text-sidebar-foreground";
export const ICON_TAB = `size-7 px-0 ${TAB}`;
const WORD_TAB = `px-3 ${TAB}`;

/** Icon tabs are 24px squares at `sm`, 28px at `md` and 32px at `lg`; word tabs keep one
    height. Set on the track, so every tab in a strip matches. */
export type TabsSize = "sm" | "md" | "lg";

export function Tabs({
  className,
  size = "sm",
  ...props
}: ComponentProps<typeof SegmentedTabs> & { readonly size?: TabsSize }) {
  return (
    <SegmentedTabs
      data-fork-tabs=""
      data-fork-tabs-size={size}
      {...props}
      className={cn(TABS_TRACK, className)}
    />
  );
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
