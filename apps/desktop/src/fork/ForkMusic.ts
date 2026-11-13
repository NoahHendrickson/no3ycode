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
import {
  commandForkMusic,
  followForkMusic,
  type ForkMusicState,
  type ForkMusicTarget,
  latestForkMusicState,
  libraryPageForkMusic,
  upNextForkMusic,
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
/** How long a launch may take, in half-second tries. */
const LAUNCH_ATTEMPTS = 30;

// ah ahh validates commands and Apple Music paths itself, so they pass through unexamined.
const Request = Schema.Union([
  Schema.Struct({ type: Schema.Literal("follow") }),
  Schema.Struct({ type: Schema.Literal("unfollow") }),
  Schema.Struct({ type: Schema.Literal("open") }),
  Schema.Struct({ type: Schema.Literal("upNext") }),
  Schema.Struct({
    type: Schema.Literal("command"),
    action: Schema.String,
    value: Schema.optional(Schema.Unknown),
  }),
  Schema.Struct({
    type: Schema.Literal("libraryPage"),
    path: Schema.String,
    offset: Schema.Number,
    limit: Schema.optional(Schema.Number),
  }),
]);
const decodeRequest = Schema.decodeUnknownEffect(Request);

const target = (): ForkMusicTarget => ({
  origin: AH_AHH_REMOTE_ORIGIN,
  tokenFile: NodePath.join(Electron.app.getPath("appData"), AH_AHH_DATA_FOLDER, "remote.json"),
});

/** Pages with the panel open. The stream to ah ahh is held only while there is one. */
const followers = new Set<Electron.WebContents>();
const hooked = new WeakSet<Electron.WebContents>();
let stopStream: (() => void) | null = null;
const lastState = latestForkMusicState();

/** Starts the stream when a page follows and none is running, or the last one ended. */
function ensureStream(): void {
  const latest = lastState.get();
  const ended = latest !== null && latest.status !== "ready";
  if (followers.size === 0 || (stopStream !== null && !ended)) return;
  stopStream?.();
  lastState.set(null);
  stopStream = followForkMusic(target(), (state) => {
    lastState.set(state);
    for (const follower of followers) {
      if (!follower.isDestroyed()) follower.send(FORK_MUSIC_STATE_CHANNEL, state);
    }
  });
}

function unfollow(contents: Electron.WebContents): void {
  followers.delete(contents);
  if (followers.size > 0) return;
  stopStream?.();
  stopStream = null;
  lastState.set(null);
}

/** Answers with the state last streamed, for a page that joins a stream already open. */
function follow(contents: Electron.WebContents): ForkMusicState | null {
  followers.add(contents);
  if (!hooked.has(contents)) {
    hooked.add(contents);
    // A reload, a crash or a closed window ends the page without its panel's unfollow.
    const drop = () => unfollow(contents);
    contents.on("destroyed", drop);
    contents.on("render-process-gone", drop);
    contents.on("did-start-navigation", (details) => {
      if (details.isMainFrame && !details.isSameDocument) drop();
    });
  }
  ensureStream();
  return lastState.get();
}

/**
 * True once ah ahh's player answers. Starts it first when it is not already up, hidden and
 * behind this app; macOS only, where `open` finds it by bundle id. False when it is not
 * installed or never answered.
 */
async function openAhAhh(canLaunch: boolean): Promise<boolean> {
  if (await waitForForkMusicPlayer(target(), 1)) return true;
  if (!canLaunch) return false;
  const launched = await new Promise<boolean>((resolve) => {
    NodeChildProcess.execFile("/usr/bin/open", ["-g", "-j", "-b", AH_AHH_BUNDLE_ID], (error) =>
      resolve(error === null),
    );
  });
  return launched && (await waitForForkMusicPlayer(target(), LAUNCH_ATTEMPTS));
}

export const installForkMusicIpc = Effect.fn("desktop.fork.installMusic")(function* () {
  const ipc = yield* DesktopIpc.DesktopIpc;
  const platform = yield* HostProcess.Platform;

  yield* ipc.handle({
    channel: FORK_MUSIC_CHANNEL,
    handler: Effect.fn("desktop.ipc.fork.music")(function* (raw, event) {
      const request = yield* decodeRequest(raw);
      switch (request.type) {
        case "follow":
        case "unfollow": {
          const contents =
            event === undefined ? undefined : Electron.webContents.fromId(event.sender.id);
          if (contents === undefined) return null;
          if (request.type === "follow") return follow(contents);
          unfollow(contents);
          return null;
        }
        case "open": {
          const opened = yield* Effect.promise(() => openAhAhh(platform === "darwin"));
          // The panel that asked followed a closed ah ahh, and that stream has ended.
          if (opened) ensureStream();
          return opened;
        }
        case "command":
          return yield* Effect.promise(() =>
            commandForkMusic(target(), { action: request.action, value: request.value }),
          );
        case "upNext":
          return yield* Effect.promise(() => upNextForkMusic(target()));
        case "libraryPage":
          return yield* Effect.promise(() =>
            libraryPageForkMusic(target(), request.path, request.offset, request.limit),
          );
      }
    }),
  });
});
