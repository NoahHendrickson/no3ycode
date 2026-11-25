/** Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. Live Activities are iOS only. */
import type { LiveActivity } from "expo-widgets";

import type { No3yLiveActivityProps } from "./no3yLiveActivity";

export function dismissEndedNo3yLiveActivities(): void {}

export function getNo3yLiveActivities(): Array<LiveActivity<No3yLiveActivityProps>> {
  return [];
}

export function startNo3yLiveActivity(
  _props: No3yLiveActivityProps,
  _staleDate: Date,
): LiveActivity<No3yLiveActivityProps> | null {
  return null;
}
