/** Fork-owned — see `.fork/customizations.yaml#no3y-push` and `#no3y-live-activity`. */
import * as Option from "effect/Option";
import { AsyncResult } from "effect/reactivity";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { environmentCatalog } from "../src/connection/catalog";
import { appAtomRegistry } from "../src/state/atom-registry";
import { mobilePreferencesAtom } from "../src/state/preferences";
import { isNo3yBundleIdentifier, NO3Y_PUSH_MOUNT_PATH } from "./no3yConstants";
import {
  armNo3yLiveActivity,
  endNo3yLiveActivities,
  refreshNo3yLiveActivity,
} from "./no3yLiveActivityClient";
import { setNo3yLiveActivityArmOnSend } from "./no3yLiveActivityHook";

type Catalog = ReturnType<typeof readCatalog>;

function readCatalog() {
  return appAtomRegistry.get(environmentCatalog.catalogValueAtom);
}

// Only Tailscale HTTPS routes reach the push service; other routes would hand the token elsewhere.
export function no3yPushOrigins(catalog: Catalog): ReadonlyArray<string> {
  const origins = new Set<string>();
  for (const entry of catalog.entries.values()) {
    const profiles = [
      entry.profile,
      ...(entry.alternateRoutes ?? []).map((route) => route.profile),
    ];
    for (const profile of profiles) {
      if (Option.isNone(profile) || profile.value._tag !== "BearerConnectionProfile") continue;
      try {
        const url = new URL(profile.value.httpBaseUrl);
        if (url.protocol === "https:" && url.hostname.endsWith(".ts.net")) origins.add(url.origin);
      } catch {
        // An unparsable saved URL has no push service behind it.
      }
    }
  }
  return [...origins];
}

export function installNo3yPushRegistration(): () => void {
  // The topic is this build's bundle ID: dev and preview tokens fail on production's.
  const topic = Application.applicationId;
  // An upstream-identity build (NO3Y_MOBILE_IDENTITY=0) uses upstream's own notification flow.
  if (Platform.OS !== "ios" || !isNo3yBundleIdentifier(topic)) return () => {};
  setNo3yLiveActivityArmOnSend((input) =>
    armNo3yLiveActivity(no3yPushOrigins(readCatalog()), input),
  );
  let disposed = false;
  let token: string | null = null;
  const registered = new Set<string>();

  const register = (catalog: Catalog) => {
    if (token === null) return;
    for (const origin of no3yPushOrigins(catalog)) {
      const key = `${origin} ${token}`;
      if (registered.has(key)) continue;
      registered.add(key);
      void fetch(`${origin}${NO3Y_PUSH_MOUNT_PATH}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, topic }),
      })
        .then((response) => {
          if (!response.ok) registered.delete(key);
        })
        .catch(() => registered.delete(key));
    }
  };

  const useToken = (next: unknown) => {
    if (typeof next !== "string" || next.length === 0 || disposed) return;
    token = next;
    register(readCatalog());
  };

  void (async () => {
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;
    useToken((await Notifications.getDevicePushTokenAsync()).data);
  })().catch(() => {});

  const tokenSubscription = Notifications.addPushTokenListener((next) => useToken(next.data));
  // The saved routes load after launch; the first time one reaches the Mac, check for running work.
  let liveActivityChecked = false;
  const checkLiveActivityOnce = (catalog: Catalog) => {
    const origins = no3yPushOrigins(catalog);
    if (liveActivityChecked || origins.length === 0) return;
    liveActivityChecked = true;
    void refreshNo3yLiveActivity(origins);
  };
  checkLiveActivityOnce(readCatalog());
  const unsubscribeCatalog = appAtomRegistry.subscribe(
    environmentCatalog.catalogValueAtom,
    (catalog) => {
      register(catalog);
      checkLiveActivityOnce(catalog);
    },
  );
  // Settings → Notifications → Live Activities off takes the card down at once.
  const unsubscribePreferences = appAtomRegistry.subscribe(mobilePreferencesAtom, (result) => {
    if (AsyncResult.isSuccess(result) && result.value.liveActivitiesEnabled === false) {
      endNo3yLiveActivities();
    }
  });
  // Re-registering on foreground recovers from a Mac that was asleep or a service restart.
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    registered.clear();
    register(readCatalog());
    void refreshNo3yLiveActivity(no3yPushOrigins(readCatalog()));
  });

  return () => {
    disposed = true;
    setNo3yLiveActivityArmOnSend(null);
    tokenSubscription.remove();
    unsubscribeCatalog();
    unsubscribePreferences();
    appStateSubscription.remove();
  };
}
