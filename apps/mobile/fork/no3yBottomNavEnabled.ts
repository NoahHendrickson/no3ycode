/**
 * Whether the no3y dock layout is on — see `.fork/customizations.yaml#no3y-mobile-redesign`.
 * Where the compact workspace tabs would be (useCompactWorkspaceTabs). Kept apart from that
 * module and the dock so screens that only branch on it skip their native glass imports.
 */
import { Platform } from "react-native";

import { useAdaptiveWorkspaceLayout } from "../src/features/layout/adaptive-workspace-context";
import { isDuoDevice } from "../src/lib/device-type";
import { useDeviceType } from "../src/native/native-layout-metrics";

export function useNo3yBottomNavEnabled(): boolean {
  const deviceType = useDeviceType();
  const { layout } = useAdaptiveWorkspaceLayout();
  return (
    Platform.OS === "ios" &&
    deviceType !== "pad" &&
    !layout.usesSplitView &&
    !isDuoDevice(deviceType)
  );
}
