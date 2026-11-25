/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. The phone's half of the no3y
 * Live Activity: it starts the one card in the foreground (on send, or on opening the app while the
 * Mac has work running) and hands its update token to the Mac push service, which pushes the rest.
 * Only installNo3yPushRegistration reaches this, and only in a no3y iOS build.
 */
import { AsyncResult } from "effect/reactivity";
import * as Application from "expo-application";
import type { LiveActivity } from "expo-widgets";

import { loadPreferences } from "../src/persistence/imperative";
import { appAtomRegistry } from "../src/state/atom-registry";
import { mobilePreferencesAtom } from "../src/state/preferences";
import {
  NO3Y_LIVE_ACTIVITY_STALE_MS,
  startingNo3yLiveActivity,
  type No3yLiveActivityProps,
} from "./no3yLiveActivity";
import {
  dismissEndedNo3yLiveActivities,
  getNo3yLiveActivities,
  startNo3yLiveActivity,
} from "./no3yLiveActivityNative";
import { NO3Y_PUSH_MOUNT_PATH } from "./no3yConstants";

type Card = LiveActivity<No3yLiveActivityProps>;

/** The latest routes to the Mac, so a token that rotates later goes wherever the Mac is now. */
let routes: ReadonlyArray<string> = [];
/** Activity ids whose token listener is installed, so a refresh never stacks listeners. */
const listening = new Set<string>();

function postToken(token: string) {
  const body = JSON.stringify({ token, topic: Application.applicationId });
  for (const origin of routes) {
    void fetch(`${origin}${NO3Y_PUSH_MOUNT_PATH}/live-activity`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => {});
  }
}

// The Mac pushes the current card to a token as soon as it has it, so registering also repairs drift.
function register(card: Card) {
  void card
    .getPushToken()
    .then((token) => {
      if (token) void allowed().then((ok) => ok && postToken(token));
    })
    .catch(() => {});
  const id = card.getId();
  if (listening.has(id)) return;
  listening.add(id);
  card.addPushTokenListener((event) => {
    const token = event.pushToken;
    if (token) void allowed().then((ok) => ok && postToken(token));
  });
}

function start(props: No3yLiveActivityProps) {
  const card = startNo3yLiveActivity(props, new Date(Date.now() + NO3Y_LIVE_ACTIVITY_STALE_MS));
  if (card) register(card);
}

/** Upstream's Settings → Notifications switch turns this card off too. */
async function allowed(): Promise<boolean> {
  // The atom takes the switch at once; the stored copy only once the save lands.
  const current = appAtomRegistry.get(mobilePreferencesAtom);
  if (AsyncResult.isSuccess(current)) return current.value.liveActivitiesEnabled !== false;
  const stored = await loadPreferences().catch(() => null);
  return stored?.liveActivitiesEnabled !== false;
}

/** On every send. No route to the Mac means nothing could ever update or end the card. */
export function armNo3yLiveActivity(
  origins: ReadonlyArray<string>,
  input: { readonly threadTitle: string; readonly projectTitle: string },
): void {
  routes = origins;
  if (origins.length === 0) return;
  void allowed().then((ok) => {
    if (!ok) return;
    try {
      const existing = getNo3yLiveActivities()[0];
      if (existing) register(existing);
      else start(startingNo3yLiveActivity(input, new Date().toISOString()));
    } catch {
      // ActivityKit refuses when Live Activities are off in iOS Settings; alert pushes still arrive.
    }
  });
}

async function readMacCard(): Promise<No3yLiveActivityProps | null> {
  for (const origin of routes) {
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

/** Takes every fork card down now, ended ones included, so the Mac can't keep one going. */
export function endNo3yLiveActivities(): void {
  try {
    dismissEndedNo3yLiveActivities();
    for (const card of getNo3yLiveActivities()) void card.end("immediate").catch(() => {});
  } catch {
    // Nothing to take down.
  }
}

/** On foreground: keep the one card registered, or start it when the Mac has work running. */
export async function refreshNo3yLiveActivity(origins: ReadonlyArray<string>): Promise<void> {
  routes = origins;
  if (!(await allowed())) {
    endNo3yLiveActivities();
    return;
  }
  if (origins.length === 0) return;
  try {
    dismissEndedNo3yLiveActivities();
    const [card, ...extras] = getNo3yLiveActivities();
    for (const extra of extras) void extra.end("immediate").catch(() => {});
    if (card) {
      register(card);
      return;
    }
    const props = await readMacCard();
    if (props === null || props.activeCount === 0 || !(await allowed())) return;
    // Checked after the last await: a send may have started the card while the Mac answered.
    if (!getNo3yLiveActivities()[0]) start(props);
  } catch {
    // Same as arming: Live Activities may be off for this app.
  }
}
