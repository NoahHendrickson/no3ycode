// @effect-diagnostics nodeBuiltinImport:off
// @effect-diagnostics globalTimers:off -- The bounded wait for a launching ah ahh runs outside any Effect fiber.
// @effect-diagnostics globalFetch:off -- Plain promises on purpose: this runs outside any Effect runtime, from a shell or a test.
/**
 * The client for ah ahh's remote API (its electron/remote.js), which the music panel drives.
 * Free of Electron so it can be run against a real ah ahh from a shell or a test.
 * See .fork/customizations.yaml#fork-music-panel.
 */
import * as NodeFSP from "node:fs/promises";

export interface ForkMusicTarget {
  /** ah ahh's remote server, always up on loopback while it runs. */
  readonly origin: string;
  /** `remote.json` in ah ahh's data folder: the pairing token, readable only by the user. */
  readonly tokenFile: string;
}

export type ForkMusicRequest =
  | { readonly type: "queue" }
  | { readonly type: "command"; readonly action: string; readonly value?: unknown }
  | { readonly type: "music"; readonly path: string; readonly params?: unknown };

/** `closed`: ah ahh is not running, or has never run. `error`: it answered, but not usefully. */
type Unavailable = { readonly status: "closed" | "error" };

// Read per call: ah ahh's Reset pairing replaces it, and a cached one would then fail forever.
async function authorization(target: ForkMusicTarget): Promise<string | null> {
  try {
    const { token } = JSON.parse(await NodeFSP.readFile(target.tokenFile, "utf8")) as {
      token?: unknown;
    };
    return typeof token === "string" && token !== "" ? `Bearer ${token}` : null;
  } catch {
    return null;
  }
}

/** Never rejects: the panel draws `closed` and `error` as states, not as failed calls. */
export async function requestForkMusic(
  target: ForkMusicTarget,
  request: ForkMusicRequest,
): Promise<unknown> {
  const bearer = await authorization(target);
  if (bearer === null) return { status: "closed" } satisfies Unavailable;
  const post = (path: string, body: unknown) =>
    fetch(`${target.origin}${path}`, {
      method: "POST",
      headers: { authorization: bearer, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    switch (request.type) {
      case "queue": {
        const response = await fetch(`${target.origin}/v1/queue`, {
          headers: { authorization: bearer },
        });
        return response.ok ? { queue: await response.json() } : { status: "error" };
      }
      case "command": {
        const response = await post("/v1/command", {
          action: request.action,
          value: request.value,
        });
        return { ok: response.ok };
      }
      case "music": {
        const response = await post("/v1/music", { path: request.path, params: request.params });
        // Apple answers 404 for an empty playlist's tracks.
        if (response.status === 404) return { data: null };
        return response.ok ? { data: await response.json() } : { status: "error" };
      }
    }
  } catch {
    return { status: "closed" } satisfies Unavailable;
  }
}

/**
 * Waits for a launching ah ahh to answer for its player, not just its server: the server is
 * up within a moment, but until the page inside has loaded, a library call hangs for ah ahh's
 * own fifteen seconds. Bounded; false when it never came up.
 */
export async function waitForForkMusicPlayer(
  target: ForkMusicTarget,
  attempts = 30,
  delayMs = 500,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // The token file is ah ahh's to create, on its first ever launch.
    const bearer = await authorization(target);
    try {
      if (bearer !== null) {
        const response = await fetch(`${target.origin}/v1/queue`, {
          headers: { authorization: bearer },
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) return true;
      }
    } catch {
      // Not listening yet, or the page has not loaded to answer.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Streams ah ahh's player state to `onState` until the returned function is called. ah ahh
 * re-sends the state every ten seconds to carry the playback position, which the panel does
 * not show, so a state that differs only in position is dropped. A stream that ends on its
 * own reports `closed` once and is not retried here.
 */
export function followForkMusic(
  target: ForkMusicTarget,
  onState: (state: unknown) => void,
): () => void {
  const abort = new AbortController();
  const run = async () => {
    const bearer = await authorization(target);
    if (bearer === null) return "closed";
    const response = await fetch(`${target.origin}/v1/events`, {
      headers: { authorization: bearer },
      signal: abort.signal,
    });
    if (!response.ok || response.body === null) return "error";
    const decoder = new TextDecoder();
    let buffered = "";
    let lastSent = "";
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split("\n");
      buffered = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const state = JSON.parse(line.slice("data: ".length)) as Record<string, unknown>;
        const comparable = JSON.stringify({ ...state, positionMs: 0 });
        if (comparable === lastSent) continue;
        lastSent = comparable;
        onState({ ...state, status: "ready" });
      }
    }
    return "closed";
  };
  void run()
    .catch(() => "closed" as const)
    .then((status) => {
      if (!abort.signal.aborted) onState({ status } satisfies Unavailable);
    });
  return () => abort.abort();
}
