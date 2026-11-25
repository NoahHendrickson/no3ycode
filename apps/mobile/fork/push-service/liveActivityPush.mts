/**
 * Fork-owned — see `.fork/customizations.yaml#no3y-live-activity`. Pushes the no3y Live Activity
 * card to every registered activity token: an update when what a token last got differs, an end
 * once nothing is active. One publish path decides both, for new, restored and refreshed tokens.
 */
import { NO3Y_BUNDLE_IDENTIFIER } from "../no3yConstants.ts";
import {
  NO3Y_LIVE_ACTIVITY_NAME,
  NO3Y_LIVE_ACTIVITY_STALE_MS,
  no3yLiveActivitySignature,
  type No3yLiveActivityProps,
} from "../no3yLiveActivity.ts";
import type { ApnsRequest, Delivery, PushToken, TokenStore } from "./apns.mts";

const COALESCE_MS = 500;
// Re-pushes before the 10-minute stale date, and lets finished rows age off the card.
const HEARTBEAT_MS = 4 * 60 * 1_000;
const STALE_AFTER_S = NO3Y_LIVE_ACTIVITY_STALE_MS / 1_000;
const DISMISS_AFTER_S = 5 * 60;
const CONTENTLESS_DISMISS_AFTER_S = 15;

export function liveActivityRequest(
  event: "update" | "end",
  props: No3yLiveActivityProps | null,
  nowMs: number,
) {
  const timestamp = Math.floor(nowMs / 1000);
  const contentState =
    props === null
      ? {}
      : { "content-state": { name: NO3Y_LIVE_ACTIVITY_NAME, props: JSON.stringify(props) } };
  const priority: ApnsRequest["priority"] =
    event === "end" || (props?.waitingCount ?? 0) > 0 ? "10" : "5";
  const expiry =
    event === "update"
      ? { "stale-date": timestamp + STALE_AFTER_S }
      : {
          "dismissal-date":
            timestamp + (props === null ? CONTENTLESS_DISMISS_AFTER_S : DISMISS_AFTER_S),
        };
  return { priority, payload: { aps: { timestamp, event, ...contentState, ...expiry } } };
}

export interface LiveActivityService {
  readonly register: (token: PushToken) => void;
  /** Something on the card may have changed; publishes are coalesced. */
  readonly changed: () => void;
  /** The shell stream is down: push nothing, so an unwatched card goes stale. */
  readonly pause: () => void;
  /** A fresh snapshot is in: every token gets the current card again. */
  readonly resume: () => void;
  readonly current: () => No3yLiveActivityProps | null;
}

export function makeLiveActivityService(input: {
  readonly store: TokenStore;
  readonly read: () => No3yLiveActivityProps | null;
  readonly deliver: (token: PushToken, request: ApnsRequest) => Promise<Delivery>;
  /** Matches the alerts' completion hold: a run can end just before its continuation starts. */
  readonly holdMs: number;
  readonly log: (message: string) => void;
}): LiveActivityService {
  // Nothing is known until the first snapshot, so a token registered before it is left alone.
  let paused = true;
  /** The signature each token last accepted; a token missing here gets the current card. */
  const sent = new Map<string, string>();
  let coalesce: ReturnType<typeof setTimeout> | undefined;
  let ending: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let queue: Promise<void> = Promise.resolve();
  /** Bumps whenever work is seen, so an end queued before it stands down. */
  let epoch = 0;

  const send = (
    event: "update" | "end",
    props: No3yLiveActivityProps | null,
    tokens: ReadonlyArray<PushToken>,
  ) => {
    if (tokens.length === 0) return;
    const queuedAt = epoch;
    queue = queue.then(async () => {
      for (const token of tokens) {
        // An end waits behind slower pushes; by each token's turn work may be back or the stream down.
        if (
          event === "end" &&
          (paused || epoch !== queuedAt || (input.read()?.activeCount ?? 0) > 0)
        ) {
          changed();
          return;
        }
        const request: ApnsRequest = {
          pushType: "liveactivity",
          topic: `${token.topic ?? NO3Y_BUNDLE_IDENTIFIER}.push-type.liveactivity`,
          ...liveActivityRequest(event, props, Date.now()),
        };
        const delivery = await input.deliver(token, request);
        // A failed push is retried by the next publish: an update re-sends, an end keeps the token.
        if (delivery === "failed") sent.delete(token.token);
        else if (event === "end") {
          input.store.update((all) => all.filter((t) => t.token !== token.token));
          sent.delete(token.token);
        }
      }
      input.log(`live activity ${event} to ${tokens.length} token(s)`);
    });
  };

  const publish = (force: boolean) => {
    if (paused) return;
    const props = input.read();
    const tokens = input.store.read();
    if (props !== null && props.activeCount > 0) {
      epoch += 1;
      clearTimeout(ending);
      ending = undefined;
      heartbeat ??= setInterval(() => publish(true), HEARTBEAT_MS);
      const signature = no3yLiveActivitySignature(props);
      const behind = tokens.filter((token) => force || sent.get(token.token) !== signature);
      for (const token of behind) sent.set(token.token, signature);
      if (behind.length > 0) send("update", props, behind);
      return;
    }
    clearInterval(heartbeat);
    heartbeat = undefined;
    if (tokens.length === 0 || ending !== undefined) return;
    ending = setTimeout(() => {
      ending = undefined;
      const final = input.read();
      if (final !== null && final.activeCount > 0) publish(false);
      else send("end", final, input.store.read());
    }, input.holdMs);
  };

  const changed = () => {
    if (paused || coalesce !== undefined) return;
    coalesce = setTimeout(() => {
      coalesce = undefined;
      publish(false);
    }, COALESCE_MS);
  };

  return {
    register: (token) => {
      input.store.update((all) => [...all.filter((t) => t.token !== token.token), token]);
      sent.delete(token.token);
      // A card armed on send gets the full hold for its run to show, not what is left of one.
      clearTimeout(ending);
      ending = undefined;
      input.log(`registered live activity ${token.token.slice(0, 8)}… for ${token.topic}`);
      changed();
    },
    changed,
    pause: () => {
      paused = true;
      clearTimeout(coalesce);
      coalesce = undefined;
      clearTimeout(ending);
      ending = undefined;
      clearInterval(heartbeat);
      heartbeat = undefined;
      sent.clear();
    },
    resume: () => {
      paused = false;
      changed();
    },
    current: input.read,
  };
}
