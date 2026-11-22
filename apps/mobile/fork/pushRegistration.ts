/** Fork-owned — see `.fork/customizations.yaml#no3y-push`. */
import * as Option from "effect/Option";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { environmentCatalog } from "../src/connection/catalog";
import { appAtomRegistry } from "../src/state/atom-registry";

// The Mac push service is mounted here by Tailscale Serve, next to the T3 server.
export const NO3Y_PUSH_REGISTER_PATH = "/no3y-push/register";

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
  if (Platform.OS !== "ios") return () => {};
  let disposed = false;
  let token: string | null = null;
  const registered = new Set<string>();

  const register = (catalog: Catalog) => {
    if (token === null) return;
    for (const origin of no3yPushOrigins(catalog)) {
      const key = `${origin} ${token}`;
      if (registered.has(key)) continue;
      registered.add(key);
      void fetch(`${origin}${NO3Y_PUSH_REGISTER_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
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
  const unsubscribeCatalog = appAtomRegistry.subscribe(
    environmentCatalog.catalogValueAtom,
    register,
  );
  // Re-registering on foreground recovers from a Mac that was asleep or a service restart.
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    registered.clear();
    register(readCatalog());
  });

  return () => {
    disposed = true;
    tokenSubscription.remove();
    unsubscribeCatalog();
    appStateSubscription.remove();
  };
}
