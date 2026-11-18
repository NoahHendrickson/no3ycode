import type { ReactNode } from "react";

import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar";

export type SurfaceName = "stage" | "sidebar" | "page" | "composer" | "app-sidebar" | "bare";

// Atom canvases carry only the app's scope markers, so a theme's tokens apply without its layout:
// stage = the chat column and header, sidebar = the sidebar's restated surface family, page =
// Settings and the utility pages. Composites get the app's real structure.
export function Surface({
  name,
  children,
  inline = false,
}: {
  name: SurfaceName;
  children: ReactNode;
  /** On a docs page the example sits in the page's flow, so it sizes to its content. */
  inline?: boolean;
}) {
  const height = inline ? "min-h-48" : "min-h-screen";
  const centred = `flex ${height} items-center justify-center p-10`;
  switch (name) {
    case "sidebar":
      return (
        <div
          data-app-sidebar=""
          data-sidebar-version="v2"
          data-story-canvas=""
          className={`${centred} bg-background text-foreground`}
        >
          {children}
        </div>
      );
    case "page":
      return (
        <div
          data-app-modal=""
          data-story-canvas=""
          className={`${centred} bg-background text-foreground`}
        >
          {children}
        </div>
      );
    case "composer":
      return (
        <div
          data-chat-column-maximized-away=""
          data-story-canvas=""
          className={`flex ${height} flex-col justify-end bg-background p-6 text-foreground`}
        >
          {children}
        </div>
      );
    case "app-sidebar":
      return (
        <SidebarProvider className={height}>
          <Sidebar
            side="left"
            collapsible="offcanvas"
            data-app-sidebar=""
            data-sidebar-version="v2"
          >
            <SidebarContent data-story-canvas="" className="pt-6">
              {children}
            </SidebarContent>
          </Sidebar>
          <SidebarInset />
        </SidebarProvider>
      );
    case "bare":
      return (
        <div data-story-canvas="" className={`${height} bg-background p-10 text-foreground`}>
          {children}
        </div>
      );
    default:
      return (
        <div
          data-chat-column-maximized-away=""
          data-story-canvas=""
          className={`${centred} bg-background text-foreground`}
        >
          {children}
        </div>
      );
  }
}
