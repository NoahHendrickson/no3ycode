/**
 * Holds a no3y Home tab's new-task flow while another flow is served — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. New agent and Chat stay mounted when hidden,
 * but the root provider serves one flow at a time: the hidden tab keeps the value it last had, so
 * it never renders the other tab's draft, and its callbacks still write its own flow.
 */
import { useAtomValue } from "@effect/atom-react";
import { useNavigationState } from "@react-navigation/native";
import { use, useState, type ReactNode } from "react";

import { No3yNewTaskFlowContext } from "../src/features/threads/new-task-flow-provider";
import { ActiveNewTaskContext } from "../src/state/active-new-task";
import { no3yHomeTabsAtom, resolveNo3yHomeDraftFlow } from "./no3yHomeTabs";

export function No3yHomeDraftGate(props: {
  readonly flowKey: string;
  readonly children: ReactNode;
}) {
  const homeTabs = useAtomValue(no3yHomeTabsAtom);
  // The root layout serves the same resolution of the same routes (Stack.tsx).
  const served = useNavigationState(
    (state) => resolveNo3yHomeDraftFlow(state.routes, homeTabs)?.flowKey === props.flowKey,
  );
  const flow = use(No3yNewTaskFlowContext);
  const activeNewTask = use(ActiveNewTaskContext);
  const [held, setHeld] = useState({ flow, activeNewTask });
  if (served && (held.flow !== flow || held.activeNewTask !== activeNewTask)) {
    setHeld({ flow, activeNewTask });
  }
  const shown = served ? { flow, activeNewTask } : held;
  return (
    <ActiveNewTaskContext value={shown.activeNewTask}>
      <No3yNewTaskFlowContext value={shown.flow}>{props.children}</No3yNewTaskFlowContext>
    </ActiveNewTaskContext>
  );
}
