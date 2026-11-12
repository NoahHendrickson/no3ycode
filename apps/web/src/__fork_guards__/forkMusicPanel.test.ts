// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard for .fork/customizations.yaml#fork-music-panel. Pins the joins a sync could
 * drop (two channels, one surface kind, the button) and runs the store against a fake
 * bridge. The desktop's client for ah ahh has its own test beside it.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it, vi } from "vite-plus/test";

import type { MusicRequest } from "../custom/music/musicBridge";
import { readMusicBridge } from "../custom/music/musicBridge";
import {
  browseMusicPlaylist,
  getMusicSnapshot,
  launchMusicWhenClosed,
  MUSIC_ALL_SONGS,
  playBrowsedTrack,
  setMusicVolume,
  subscribeMusic,
} from "../custom/music/musicStore";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const desktopMethod = readSibling("../../../desktop/src/fork/ForkMusic.ts");
const desktopHandlers = readSibling("../../../desktop/src/ipc/DesktopIpcHandlers.ts");
const desktopPreload = readSibling("../../../desktop/src/preload.ts");
const rightPanelStore = readSibling("../rightPanelStore.ts");
const surfaceContent = readSibling("../components/chat/RightPanelSurfaceContent.tsx");
const layoutControls = readSibling("../components/chat/PanelLayoutControls.tsx");
const chatView = readSibling("../components/ChatView.tsx");
const toggle = readSibling("../custom/music/MusicPanelToggle.tsx");
const customizations = readSibling("../../../../.fork/customizations.yaml");

const fenced = (body: string) =>
  new RegExp(
    `fork:begin fork-music-panel[\\s\\S]*?${body}[\\s\\S]*?fork:end fork-music-panel`,
    "u",
  );

const ready = (title: string, volume: number, queueRevision: number) => ({
  status: "ready",
  playing: true,
  title,
  artist: "Artist",
  album: "Album",
  artwork: null,
  volume,
  queueRevision,
});

const rows = (count: number, from: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `i.${from + i}`,
    attributes: { name: `Song ${from + i}`, artistName: "Artist" },
  }));

describe("fork guard: fork-music-panel", () => {
  it("wires two channels through the desktop method, the preload and the handlers", () => {
    expect(desktopMethod).toContain('FORK_MUSIC_CHANNEL = "fork:music"');
    expect(desktopMethod).toContain('FORK_MUSIC_STATE_CHANNEL = "fork:music-state"');
    expect(desktopPreload).toMatch(fenced('ipcRenderer\\.invoke\\("fork:music", request\\)'));
    expect(desktopPreload).toMatch(fenced('ipcRenderer\\.on\\("fork:music-state", receive\\)'));
    expect(desktopHandlers).toMatch(fenced("import \\{ installForkMusicIpc \\}"));
    expect(desktopHandlers).toMatch(fenced("yield\\* installForkMusicIpc\\(\\);"));
    expect(customizations).toContain("- id: fork-music-panel");
  });

  it("is a remote for ah ahh on this computer, held open only while a panel follows", () => {
    // Loopback only, on ah ahh's remote port, with the pairing token from its own data folder.
    expect(desktopMethod).toContain('AH_AHH_REMOTE_ORIGIN = "http://127.0.0.1:10771"');
    expect(desktopMethod).toContain(
      'NodePath.join(Electron.app.getPath("appData"), AH_AHH_DATA_FOLDER, "remote.json")',
    );
    // Clicking the music button may start ah ahh, hidden and behind this app; a remount may not.
    expect(desktopMethod).toContain('AH_AHH_BUNDLE_ID = "dev.noey.ahahh"');
    expect(desktopMethod).toContain('["-g", "-j", "-b", AH_AHH_BUNDLE_ID]');
    expect(desktopPreload).toMatch(fenced('canOpen: clientPlatform === "darwin",'));
    expect(toggle).toContain("if (!open) launchMusicWhenClosed();");
    // The last panel to close ends the stream; nothing polls.
    expect(desktopMethod).toMatch(/if \(followers\.size > 0\) return;\s*stream\?\.stop\(\);/u);
    expect(desktopMethod).not.toMatch(/setInterval|setTimeout/u);
  });

  it("is a right panel tab opened from a button beside the right panel toggle", () => {
    expect(rightPanelStore).toMatch(fenced('"music",'));
    expect(rightPanelStore).toMatch(fenced('return \\{ id: "music", kind \\};'));
    expect(surfaceContent).toMatch(fenced('case "music":\\s*return <MusicPanel />;'));
    expect(layoutControls).toMatch(fenced("<MusicPanelToggle"));
    expect(layoutControls.indexOf("<MusicPanelToggle")).toBeLessThan(
      layoutControls.indexOf("data-right-panel-toggle"),
    );
    expect(chatView).toMatch(fenced("musicThreadRef: activeThreadRef,"));
    expect(toggle).toContain("if (readMusicBridge() === null) return null;");
    expect(toggle).toContain('.toggle(threadRef, "music")');
  });

  it("offers nothing without the desktop bridge", () => {
    expect(readMusicBridge()).toBeNull();
  });

  it("starts ah ahh on the button's click, pages its library, and holds the slider through a volume drag", async () => {
    const requests: MusicRequest[] = [];
    const volumeAnswers: Array<() => void> = [];
    let pushState: (state: unknown) => void = () => undefined;
    let stopped = 0;
    let running = false;
    (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge = {
      music: {
        canOpen: true,
        request: (request: MusicRequest): Promise<unknown> => {
          requests.push(request);
          if (request.type === "open") {
            running = true;
            return Promise.resolve({ ok: true });
          }
          if (request.type === "follow") {
            return Promise.resolve(running ? ready("One", 0.5, 1) : { status: "closed" });
          }
          if (request.type === "queue") {
            return Promise.resolve({
              queue: {
                position: 4,
                items: [
                  { index: 4, title: "One", artist: "Artist" },
                  { index: 5, title: "Two", artist: "Artist" },
                ],
              },
            });
          }
          if (request.type === "command" && request.action === "volume") {
            return new Promise((resolve) => volumeAnswers.push(() => resolve({ ok: true })));
          }
          if (request.type !== "music") return Promise.resolve({ ok: true });
          if (request.path === "/v1/me/library/playlists") {
            return Promise.resolve({
              data: { data: [{ id: "p.1", attributes: { name: "Girlpop" } }] },
            });
          }
          // Two pages of a playlist's tracks, or of the library's songs.
          return Promise.resolve({
            data:
              request.params?.offset === 0
                ? { data: rows(100, 0), next: "/more" }
                : { data: rows(20, 100) },
          });
        },
        onState: (listener: (state: unknown) => void) => {
          pushState = listener;
          return () => {
            stopped += 1;
          };
        },
      },
    };
    const commands = () =>
      requests.flatMap((request) => (request.type === "command" ? [request] : []));
    try {
      // The click that opens the panel finds ah ahh closed, starts it, and follows it.
      launchMusicWhenClosed();
      const unsubscribe = subscribeMusic(() => undefined);
      await vi.waitFor(() => expect(getMusicSnapshot().playlists).toHaveLength(2));
      expect(getMusicSnapshot().playlists).toEqual([
        MUSIC_ALL_SONGS,
        { id: "p.1", name: "Girlpop" },
      ]);
      // The queue's first entry is the song playing; the rest is what comes next.
      expect(getMusicSnapshot().upNext).toEqual([{ index: 5, title: "Two", artist: "Artist" }]);

      const girlpop = getMusicSnapshot().playlists?.[1];
      if (!girlpop) throw new Error("no playlist");
      await browseMusicPlaylist(girlpop);
      expect(getMusicSnapshot().browsing?.tracks).toHaveLength(120);
      expect(getMusicSnapshot().browsing?.tracks?.[119]).toEqual({
        id: "i.119",
        name: "Song 119",
        artist: "Artist",
      });
      playBrowsedTrack(7);
      expect(commands().at(-1)).toMatchObject({
        action: "playItem",
        value: { type: "library-playlists", id: "p.1", startWith: 7 },
      });

      // The library's songs are not a playlist ah ahh can be pointed at, so their ids go along.
      await browseMusicPlaylist(MUSIC_ALL_SONGS);
      playBrowsedTrack(2);
      const playSongs = commands().at(-1);
      expect(playSongs).toMatchObject({ action: "playSongs", value: { startWith: 2 } });
      expect(playSongs?.action === "playSongs" ? playSongs.value.ids.slice(0, 2) : null).toEqual([
        "i.0",
        "i.1",
      ]);

      // A drag: the first value goes out, the ones behind it collapse to the last.
      setMusicVolume(0.1);
      setMusicVolume(0.2);
      setMusicVolume(0.3);
      // ah ahh reports the volume a beat behind: the older value must not move the slider.
      pushState(ready("One", 0.1, 1));
      expect(getMusicSnapshot().state).toMatchObject({ volume: 0.3 });
      volumeAnswers[0]?.();
      await vi.waitFor(() => expect(volumeAnswers).toHaveLength(2));
      volumeAnswers[1]?.();
      await vi.waitFor(() => {
        pushState(ready("One", 0.3, 1));
        pushState(ready("One", 0.8, 1));
        // Once ah ahh has caught up, a volume changed in ah ahh itself shows again.
        expect(getMusicSnapshot().state).toMatchObject({ volume: 0.8 });
      });
      expect(
        commands().flatMap((command) => (command.action === "volume" ? [command.value] : [])),
      ).toEqual([0.1, 0.3]);

      // A changed queue is fetched again; a closed ah ahh shows as that.
      const queueReads = () => requests.filter((request) => request.type === "queue").length;
      const before = queueReads();
      pushState(ready("One", 0.8, 2));
      expect(queueReads()).toBe(before + 1);
      // Reopened mid exit animation, the panel never remounts: that click must not arm a launch.
      launchMusicWhenClosed();
      pushState({ status: "closed" });
      expect(getMusicSnapshot().state).toEqual({ status: "closed" });
      // Quit on purpose with the panel open: it stays quit until the user asks.
      expect(requests.filter((request) => request.type === "open")).toHaveLength(1);

      unsubscribe();
      expect(stopped).toBe(1);
      expect(requests.at(-1)).toEqual({ type: "unfollow" });
    } finally {
      delete (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
    }
  });
});
