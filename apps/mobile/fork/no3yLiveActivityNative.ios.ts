/** Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. */
import No3yAgentActivity from "./No3yAgentActivity";
import type { No3yLiveActivityProps } from "./no3yLiveActivity";

export function dismissEndedNo3yLiveActivities() {
  No3yAgentActivity.dismissEnded();
}

export function getNo3yLiveActivities() {
  return No3yAgentActivity.getInstances();
}

export function startNo3yLiveActivity(props: No3yLiveActivityProps, staleDate: Date) {
  return No3yAgentActivity.start(props, undefined, staleDate);
}
