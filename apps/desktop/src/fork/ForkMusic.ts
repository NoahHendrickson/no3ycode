// @effect-diagnostics nodeBuiltinImport:off
/**
 * The music panel is a remote for ah ahh, the user's own Apple Music player, on this
 * computer: ah ahh keeps MusicKit, the DRM and the audio, this relays to its remote API.
 * In the main process because the page cannot read the pairing token or cross origins.
 * See .fork/customizations.yaml#fork-music-panel.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";

import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import { forkSenderWindow } from "./ForkGlassState.ts";
import {
  followForkMusic,
  type ForkMusicTarget,
  requestForkMusic,
  waitForForkMusicPlayer,
} from "./ForkMusicClient.ts";

const FORK_MUSIC_CHANNEL = "fork:music";
const FORK_MUSIC_STATE_CHANNEL = "fork:music-state";
/** REMOTE_PORT in ah ahh's electron/main.js. */
const AH_AHH_REMOTE_ORIGIN = "http://127.0.0.1:10771";
/** `appId` in ah ahh's package.json: finds the app wherever it is installed. */
const AH_AHH_BUNDLE_ID = "dev.noey.ahahh";
/** ah ahh's Electron app name, which names its data folder. */
const AH_AHH_DATA_FOLDER = "ah ahh";

// ah ahh validates commands and Apple Music paths itself, so they pass through unexamined.
const Request = Schema.Union([
  Schema.Struct({ type: Schema.Literal("follow") }),
  Schema.Struct({ type: Schema.Literal("unfollow") }),
  Schema.Struct({ type: Schema.Literal("open") }),
  Schema.Struct({ type: Schema.Literal("queue") }),
  Schema.Struct({
    type: Schema.Literal("command"),
    action: Schema.String,
    value: Schema.optional(Schema.Unknown),
  }),
  Schema.Struct({
    type: Schema.Literal("music"),
    path: Schema.String,
    params: Schema.optional(Schema.Unknown),
  }),
]);
const decodeRequest = Schema.decodeUnknownEffect(Request);

const target = (): ForkMusicTarget => ({
  origin: AH_AHH_REMOTE_ORIGIN,
  tokenFile: NodePath.join(Electron.app.getPath("appData"), AH_AHH_DATA_FOLDER, "remote.json"),
});

/**
 * Starts ah ahh hidden and behind this app, then waits for its player. False when it is not
 * installed or never answered. macOS only: `open` finds it by bundle id; the preload tells
 * the renderer not to offer this elsewhere.
 */
function openAhAhh(): Promise<boolean> {
  return new Promise((resolve) => {
    NodeChildProcess.execFile("/usr/bin/open", ["-g", "-j", "-b", AH_AHH_BUNDLE_ID], (error) => {
      if (error) resolve(false);
      else void waitForForkMusicPlayer(target()).then(resolve);
    });
  });
}

/** Windows with the panel open. The stream to ah ahh is held only while there is one. */
const followers = new Set<Electron.BrowserWindow>();
let stream: { stop: () => void; ended: boolean } | null = null;
let lastState: unknown = null;

function unfollow(window: Electron.BrowserWindow): void {
  followers.delete(window);
  if (followers.size > 0) return;
  stream?.stop();
  stream = null;
  lastState = null;
}

/** Answers with the state last streamed, for a window that joins a stream already open. */
function follow(window: Electron.BrowserWindow): unknown {
  if (!followers.has(window)) {
    followers.add(window);
    window.once("closed", () => unfollow(window));
  }
  // An ended stream is not retried on its own; following again (the panel's Try again) is the retry.
  if (stream === null || stream.ended) {
    const started = { stop: () => {}, ended: false };
    stream = started;
    lastState = null;
    started.stop = followForkMusic(target(), (state) => {
      if (stream !== started) return;
      started.ended = (state as { status?: unknown }).status !== "ready";
      lastState = state;
      for (const follower of followers) {
        if (!follower.isDestroyed()) follower.webContents.send(FORK_MUSIC_STATE_CHANNEL, state);
      }
    });
  }
  return lastState;
}

export const installForkMusicIpc = Effect.fn("desktop.fork.installMusic")(function* () {
  const ipc = yield* DesktopIpc.DesktopIpc;
  const platform = yield* HostProcess.Platform;

  yield* ipc.handle({
    channel: FORK_MUSIC_CHANNEL,
    handler: Effect.fn("desktop.ipc.fork.music")(function* (raw, event) {
      const request = yield* decodeRequest(raw);
      if (request.type === "follow" || request.type === "unfollow") {
        const window = yield* forkSenderWindow(event);
        if (window === null || window.isDestroyed()) return null;
        if (request.type === "follow") return follow(window);
        unfollow(window);
        return null;
      }
      if (request.type === "open") {
        if (platform !== "darwin") return { ok: false };
        return { ok: yield* Effect.promise(openAhAhh) };
      }
      return yield* Effect.promise(() => requestForkMusic(target(), request));
    }),
  });
});
