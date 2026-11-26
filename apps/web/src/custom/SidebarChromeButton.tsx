/**
 * The sidebar chrome's look (Figma 364:11246 / 368:21211): the action rows, the Threads and Petals
 * rows' icon buttons, their groups and their sort menus, drawn on the sidebar primitives. State
 * rides the attributes the primitives stamp: a held row is `isActive` (data-active), a lit icon
 * `lit` (data-lit). See `.fork/customizations.yaml#fork-sidebar-chrome`.
 */
import type { ComponentProps } from "react";

import { MenuRadioItem } from "~/components/ui/menu";
import { SidebarGroup, SidebarMenuButton } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { SIDEBAR_V2_TRAILING_OFFSET } from "./sidebarV2TrailingColumn";

// Displaces sidebarMenuButtonVariants' dimmed [&>svg] pair; twMerge keeps this later same-slot pair.
// oxlint-disable-next-line shadcn/no-restyle -- the chrome's glyphs at foreground, a look only these rows draw
const CHROME_ICON_TINT = "[&>svg]:text-sidebar-foreground [&>svg]:opacity-100";
const CHROME_FOCUS =
  // oxlint-disable-next-line shadcn/no-restyle -- the chrome's hover fill and inset ring, a look only these rows draw
  "hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";
// The design system's ghost button: 10px corners, px-12, gap-6, Label/14 Regular at foreground.
// oxlint-disable-next-line shadcn/no-restyle -- the chrome row's look, which only these rows draw
const CHROME_ROW = `gap-1.5 rounded-(--radius-sidebar-row) py-1.5 border-0 bg-transparent px-3 ${CHROME_FOCUS} text-sidebar-chrome font-normal text-sidebar-foreground data-[active=true]:font-normal ${CHROME_ICON_TINT}`;
// The 32px icon-only ghost button at muted foreground; data-lit lifts the glyph to foreground.
// oxlint-disable-next-line shadcn/no-restyle -- the chrome icon button's look, which only these rows draw
const CHROME_ICON = `relative size-8 shrink-0 justify-center font-medium rounded-(--radius-sidebar-row) border-0 bg-transparent p-0 text-muted-foreground ${CHROME_FOCUS} ${CHROME_ICON_TINT} [&>svg]:text-current data-lit:text-sidebar-foreground`;

/** A chrome row (`shape="row"`) or one of the Threads and Petals rows' icon buttons. */
export function SidebarChromeButton({
  shape = "row",
  lit = false,
  className,
  ...props
}: Omit<ComponentProps<typeof SidebarMenuButton>, "variant" | "size"> & {
  readonly shape?: "row" | "icon";
  /** The icon's glyph at foreground: the filter while a project scope is on. */
  readonly lit?: boolean;
}) {
  return (
    <SidebarMenuButton
      size="sm"
      className={cn(shape === "row" ? CHROME_ROW : CHROME_ICON, className)}
      data-lit={lit ? "" : undefined}
      {...props}
    />
  );
}

/** The chrome rows' group on the list's 8px inset; `stack` stacks its rows 2px apart. */
export function SidebarChromeGroup({
  stack = false,
  className,
  ...props
}: ComponentProps<typeof SidebarGroup> & { readonly stack?: boolean }) {
  return (
    <SidebarGroup
      className={cn(
        // oxlint-disable-next-line shadcn/no-restyle -- the chrome rows sit on the list's own 8px inset, not the group's
        stack ? "gap-0.5 px-2 pt-0 pb-0" : "px-2 pt-0 pb-0",
        SIDEBAR_V2_TRAILING_OFFSET.chromeRow,
        className,
      )}
      {...props}
    />
  );
}

/** A row in the chrome's sort menus: a medium 14px label on a 32px row. */
export function SidebarChromeRadioItem({
  className,
  ...props
}: ComponentProps<typeof MenuRadioItem>) {
  return (
    <MenuRadioItem
      // oxlint-disable-next-line shadcn/no-restyle -- the sidebar sort menus' rows, which only the chrome draws
      className={cn("py-0 text-sm font-medium", className)}
      {...props}
    />
  );
}
