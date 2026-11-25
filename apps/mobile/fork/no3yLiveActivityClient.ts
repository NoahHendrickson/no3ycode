/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. The phone's half of the no3y
 * Live Activity: it starts the one card in the foreground (on send, or on opening the app while the
 * Mac has work running) and hands its update token to the Mac push service, which pushes the rest.
 */
import * as Application from "expo-application";
import type { LiveActivity } from "expo-widgets";

import { NO3Y_LIVE_ACTIVITY_STALE_MS, type No3yLiveActivityProps } from "./no3yLiveActivity";
import { no3yLiveActivityFactory } from "./no3yLiveActivityFactory";
import { isNo3yBundleIdentifier, NO3Y_PUSH_MOUNT_PATH } from "./no3yConstants";

type Card = LiveActivity<No3yLiveActivityProps>;

/** Activity ids whose token listener is installed, so a refresh never stacks listeners. */
const listening = new Set<string>();

function enabled(): boolean {
  return no3yLiveActivityFactory !== null && isNo3yBundleIdentifier(Application.applicationId);
}

function postToken(origins: ReadonlyArray<string>, token: string) {
  const body = JSON.stringify({ token, topic: Application.applicationId });
  for (const origin of origins) {
    void fetch(`${origin}${NO3Y_PUSH_MOUNT_PATH}/live-activity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => {});
  }
}

// The Mac pushes the current card to a token as soon as it has it, so registering also repairs drift.
function register(card: Card, origins: ReadonlyArray<string>) {
  void card
    .getPushToken()
    .then((token) => {
      if (token) postToken(origins, token);
    })
    .catch(() => {});
  const id = card.getId();
  if (listening.has(id)) return;
  listening.add(id);
  card.addPushTokenListener((event) => {
    if (event.pushToken) postToken(origins, event.pushToken);
  });
}

function start(props: No3yLiveActivityProps, origins: ReadonlyArray<string>) {
  const card = no3yLiveActivityFactory?.start(
    props,
    undefined,
    new Date(Date.now() + NO3Y_LIVE_ACTIVITY_STALE_MS),
  );
  if (card) register(card, origins);
}

/** Called on every send; false lets upstream's relay path run for an upstream-identity build. */
export function armNo3yLiveActivity(
  origins: ReadonlyArray<string>,
  input: { readonly threadTitle: string; readonly projectTitle: string },
): boolean {
  if (!enabled()) return false;
  if (origins.length === 0) return true;
  try {
    const existing = no3yLiveActivityFactory?.getInstances() ?? [];
    if (existing[0]) {
      register(existing[0], origins);
      return true;
    }
    const now = new Date().toISOString();
    start(
      {
        activeCount: 1,
        waitingCount: 0,
        failedCount: 0,
        doneCount: 0,
        updatedAt: now,
        rows: [
          {
            environmentId: "",
            threadId: "",
            threadTitle: input.threadTitle,
            projectTitle: input.projectTitle,
            provider: "",
            phase: "starting",
            updatedAt: now,
            deepLink: "/",
          },
        ],
      },
      origins,
    );
  } catch {
    // ActivityKit refuses when Live Activities are off in Settings; the alert pushes still arrive.
  }
  return true;
}

async function readMacCard(origins: ReadonlyArray<string>): Promise<No3yLiveActivityProps | null> {
  for (const origin of origins) {
    try {
      const response = await fetch(`${origin}${NO3Y_PUSH_MOUNT_PATH}/live-activity`);
      if (!response.ok) continue;
      return ((await response.json()) as { props: No3yLiveActivityProps | null }).props;
    } catch {
      // Try the next route to the Mac.
    }
  }
  return null;
}

/** On foreground: keep the one card registered, or start it when the Mac has work running. */
export async function refreshNo3yLiveActivity(origins: ReadonlyArray<string>): Promise<void> {
  if (!enabled() || origins.length === 0) return;
  try {
    no3yLiveActivityFactory?.dismissEnded();
    const [card, ...extras] = no3yLiveActivityFactory?.getInstances() ?? [];
    for (const extra of extras) void extra.end("immediate").catch(() => {});
    if (card) {
      register(card, origins);
      return;
    }
    const props = await readMacCard(origins);
    // A send may have started the card while the Mac answered.
    if (props === null || props.activeCount === 0 || no3yLiveActivityFactory?.getInstances()[0]) {
      return;
    }
    start(props, origins);
  } catch {
    // Same as arming: Live Activities may be off for this app.
  }
}
