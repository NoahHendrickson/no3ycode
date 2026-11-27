/**
 * How a coordinator hosts the threads its conversation names — see
 * `.fork/customizations.yaml#fork-coordinator-threads` and `#fork-thread-launch-cards`. A thread
 * opens in the coordinator's panel, and a child's question is answered on its card in place; once
 * settled, the card gives way to the child's row.
 */
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";

import { openBotThreadsChild } from "../bots/botThreadsPanelStore";
import { ForkThreadHookRow } from "../threadLaunchCards/ForkThreadLaunchCards";
import type { ForkThreadHost } from "../threadLaunchCards/forkThreadHost";

const AnsweredRequest: ForkThreadHost["AnsweredRequest"] = (props) => (
  <ForkThreadHookRow
    kind="report"
    threadRef={scopeThreadRef(props.thread.environmentId, props.thread.id)}
    fallbackTitle={null}
    hostRef={props.hostRef}
  />
);

/** One per coordinator, so the timeline's context value holds still across renders. */
const hosts = new Map<string, ForkThreadHost>();

/** The coordinator's host, for its timeline (ThreadTimeline's forkThreadHost). */
export function coordinatorThreadHost(coordinatorRef: ScopedThreadRef): ForkThreadHost {
  const key = scopedThreadKey(coordinatorRef);
  const known = hosts.get(key);
  if (known !== undefined) return known;
  const host: ForkThreadHost = {
    openThread: (ref) => openBotThreadsChild(coordinatorRef, ref),
    // The answer reaches the child; the coordinator keeps no record of it.
    onAnswered: () => {},
    AnsweredRequest,
  };
  hosts.set(key, host);
  return host;
}
