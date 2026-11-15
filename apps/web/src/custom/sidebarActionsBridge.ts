import type { ScopedThreadRef } from "@t3tools/contracts";

import { useThreadSelectionStore } from "~/threadSelectionStore";

/** Sidebar actions reached from outside it (fork-collapsed-thread-tabs), so both run the
    sidebar's own code. The collapsed sidebar stays mounted offcanvas, so they stay live. */
type OpenThreadMenu = (threadRef: ScopedThreadRef, position: { x: number; y: number }) => void;
type StartThreadInProject = (projectKey: string) => void;

let registeredOpenThreadMenu: OpenThreadMenu | null = null;
let registeredStartThreadInProject: StartThreadInProject | null = null;

export function registerSidebarThreadMenu(handler: OpenThreadMenu): () => void {
  registeredOpenThreadMenu = handler;
  return () => {
    if (registeredOpenThreadMenu === handler) registeredOpenThreadMenu = null;
  };
}

/** The menu for this one thread, never for a selection made in the sidebar. */
export function openSidebarThreadMenu(
  threadRef: ScopedThreadRef,
  position: { x: number; y: number },
): void {
  const selection = useThreadSelectionStore.getState();
  if (selection.hasSelection()) selection.clearSelection();
  registeredOpenThreadMenu?.(threadRef, position);
}

export function registerSidebarStartThreadInProject(handler: StartThreadInProject): () => void {
  registeredStartThreadInProject = handler;
  return () => {
    if (registeredStartThreadInProject === handler) registeredStartThreadInProject = null;
  };
}

/** False when no sidebar is mounted to start it. */
export function startSidebarThreadInProject(projectKey: string): boolean {
  if (!registeredStartThreadInProject) return false;
  registeredStartThreadInProject(projectKey);
  return true;
}
