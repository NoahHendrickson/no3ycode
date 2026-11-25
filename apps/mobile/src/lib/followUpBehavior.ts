import type { ActiveTurnComposerAction } from "@t3tools/client-runtime/state/composer-dispatch";

export type FollowUpBehavior = Extract<ActiveTurnComposerAction, "queue" | "steer">;

/* fork:begin no3y-mobile-queue-default — see .fork/customizations.yaml#no3y-mobile-queue-default */
export const DEFAULT_FOLLOW_UP_BEHAVIOR: FollowUpBehavior = "queue";
/* fork:end no3y-mobile-queue-default */
