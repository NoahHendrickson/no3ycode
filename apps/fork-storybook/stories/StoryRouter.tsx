import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { createContext, type ReactNode, use, useState } from "react";

// Components that read the router (toasts, thread links) get a memory router, the way the app's
// browser tests mount them (apps/web/test/render.tsx). The route renders whatever the story passes.
const StoryContent = createContext<ReactNode>(null);

function RoutedStory() {
  return use(StoryContent);
}

export function StoryRouter({ path, children }: { path: string; children: ReactNode }) {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: RoutedStory }),
      history: createMemoryHistory({ initialEntries: [path] }),
    }),
  );
  return (
    <StoryContent value={children}>
      <RouterProvider router={router} />
    </StoryContent>
  );
}
