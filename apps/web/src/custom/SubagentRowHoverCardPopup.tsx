import type { ComponentProps } from "react";

import { ThreadHoverCardPopup } from "~/components/ThreadHoverCard";

/** A thread details subagent row's hover card. Inlet hangs it left of its row as a tab
    (theme.custom.inlet-menus.css), which needs it top-aligned to the row; the row carries
    data-fork-row-hover-trigger. */
export function SubagentRowHoverCardPopup(props: ComponentProps<typeof ThreadHoverCardPopup>) {
  return <ThreadHoverCardPopup {...props} side="left" align="start" data-fork-row-hover-card="" />;
}
