/**
 * The conversation header's control cluster — see `.fork/customizations.yaml#fork-stage-columns`.
 * It sits at the header's right end in the header's own flow, in every state, instead of pinned
 * to the window's corner where a panel's header would have to reserve room under it.
 */
import type { ReactNode } from "react";

export function StageHeaderControls(props: { readonly children: ReactNode }) {
  return (
    <div
      className="ml-auto flex h-full shrink-0 items-center gap-1 [-webkit-app-region:no-drag]"
      // Upstream's hook for the cluster's toggle styles (index.css, the Inlet sheets).
      data-workspace-titlebar-controls=""
      data-fork-stage-header-controls=""
    >
      {props.children}
    </div>
  );
}
