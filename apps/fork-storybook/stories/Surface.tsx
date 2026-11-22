import type { ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";

export type SurfaceName = "stage" | "sidebar" | "page" | "composer" | "app-sidebar" | "bare";

// Atom canvases carry only the app's scope markers, so a theme's tokens apply without its layout:
// stage = the chat column and header, sidebar = the sidebar's restated surface family, page =
// Settings and the utility pages. Composites get the app's real structure.
const CANVASES: Record<
  Exclude<SurfaceName, "app-sidebar">,
  { readonly scope: Readonly<Record<string, string>>; readonly layout: "centred" | "end" | "flow" }
> = {
  stage: { scope: { "data-chat-column-maximized-away": "" }, layout: "centred" },
  sidebar: { scope: { "data-app-sidebar": "", "data-sidebar-version": "v2" }, layout: "centred" },
  page: { scope: { "data-app-modal": "" }, layout: "centred" },
  composer: { scope: { "data-chat-column-maximized-away": "" }, layout: "end" },
  bare: { scope: {}, layout: "flow" },
};

const LAYOUTS = {
  centred: "flex items-center justify-center p-10",
  end: "flex flex-col justify-end p-6",
  flow: "p-10",
} as const;

export function Surface({
  name,
  children,
  inline = false,
  glass = false,
}: {
  name: SurfaceName;
  children: ReactNode;
  /** On a docs page the example sits in the page's flow, so it sizes to its content. */
  inline?: boolean;
  /** Under Glass the sidebar canvas is the docked sidebar, so Liquid Glass clears it as the app does. */
  glass?: boolean;
}) {
  const height = inline ? "min-h-48" : "min-h-screen";
  if (name === "app-sidebar") {
    return (
      <SidebarProvider className={height}>
        <Sidebar side="left" collapsible="offcanvas" data-app-sidebar="" data-sidebar-version="v2">
          <SidebarContent data-story-canvas="" className="pt-6">
            {children}
          </SidebarContent>
        </Sidebar>
        {/* Below the mobile breakpoint the sidebar is a closed sheet; this opens it. */}
        <SidebarInset>
          <SidebarTrigger className="m-3 md:hidden" />
        </SidebarInset>
      </SidebarProvider>
    );
  }
  const { scope, layout } = CANVASES[name];
  const canvas = (
    <div
      {...scope}
      {...(glass && name === "sidebar" ? { "data-slot": "sidebar-container" } : {})}
      data-story-canvas=""
      className={`${LAYOUTS[layout]} ${height} bg-background text-foreground`}
    >
      {children}
    </div>
  );
  if (!glass || name !== "sidebar") return canvas;
  return (
    <div data-slot="sidebar-wrapper" className="contents">
      {canvas}
    </div>
  );
}
