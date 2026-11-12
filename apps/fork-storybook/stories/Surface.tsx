import type { ReactNode } from "react";

import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar";

export type SurfaceName = "stage" | "frame" | "page" | "panel" | "sidebar" | "composer" | "tabs";

// Atom canvases carry only the app's scope markers, so Inlet's tokens apply without its layout:
// frame = sidebar ([data-app-sidebar] recomputes the contrast inks), page = Settings and the
// utility pages, panel = the chat column. Composites get the app's real structure.
export function Surface({ name, children }: { name: SurfaceName; children: ReactNode }) {
  const centred = "flex min-h-screen items-center justify-center p-10";
  switch (name) {
    case "frame":
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
    case "panel":
      return (
        <div className="flex min-h-screen bg-(--fork-inlet-frame)">
          <div
            data-chat-column-maximized-away=""
            data-story-canvas=""
            className={`${centred} flex-1`}
          >
            {children}
          </div>
        </div>
      );
    case "composer":
      return (
        <div className="flex min-h-screen bg-(--fork-inlet-frame)">
          <div
            data-chat-column-maximized-away=""
            data-story-canvas=""
            className="flex min-h-0 flex-1 flex-col justify-end p-6"
          >
            {children}
          </div>
        </div>
      );
    // The collapsed sidebar's tab strip on the frame, over a pane, so the open tab can join it.
    // Inset past the open tab's 18px flare, as the app's strip clears the window controls.
    case "tabs":
      return (
        <div className="flex min-h-screen flex-col bg-(--fork-inlet-frame)">
          <div
            data-fork-thread-tabs=""
            className="flex h-(--workspace-topbar-height) shrink-0 items-center px-8"
          >
            <nav
              aria-label="Active threads"
              data-story-canvas=""
              className="-mx-1 -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1 py-1"
            >
              {children}
            </nav>
          </div>
          <div data-fork-thread-panes="" className="flex min-h-0 flex-1">
            <div data-chat-column-maximized-away="" className="flex-1" />
          </div>
        </div>
      );
    case "sidebar":
      return (
        <SidebarProvider className="min-h-screen">
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
    default:
      return (
        <div data-story-canvas="" className={`${centred} bg-background text-foreground`}>
          {children}
        </div>
      );
  }
}
