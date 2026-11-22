import type { ReactNode } from "react";

import { ComposerShell } from "~/custom/ComposerShell";

/** The composer's vessel at rest (nothing pending, desktop), holding only the controls a story
    passes. */
export function StoryComposer(props: {
  context?: ReactNode;
  modeControls?: ReactNode;
  usageControls?: ReactNode;
  topVessel?: ReactNode;
}) {
  return (
    <ComposerShell
      approvalPending={false}
      context={props.context}
      collapsedMobile={false}
      mobilePendingActionsVisible={false}
      modelControls={null}
      readoutControls={null}
      modeControls={props.modeControls ?? null}
      usageControls={props.usageControls}
      topVessel={props.topVessel}
    />
  );
}
