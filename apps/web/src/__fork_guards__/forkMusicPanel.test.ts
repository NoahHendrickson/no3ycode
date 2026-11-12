// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard for .fork/customizations.yaml#fork-music-panel. Pins the joins a sync could
 * drop (two channels, one surface kind, the button) and runs the store against a fake
 * bridge. The desktop's client for ah ahh has its own test beside it.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it, vi } from "vite-plus/test";

import type { MusicBridge, MusicCommand, MusicState } from "../custom/music/musicBridge";
import { readMusicBridge } from "../custom/music/musicBridge";
import {
  browseMusicSource,
  getMusicSnapshot,
  openMusic,
  playBrowsedTrack,
  retryMusic,
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

const ready = (volume: number, queueRevision = 1): MusicState => ({
  status: "ready",
  playing: true,
  title: "One",
  artist: "Artist",
  album: "Album",
  artwork: null,
  volume,
  queueRevision,
});

const songs = (count: number, from: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `i.${from + i}`,
    name: `Song ${from + i}`,
    artist: "Artist",
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
    // Opening looks before it launches, hidden and behind this app, and only the click asks.
    expect(desktopMethod).toContain("if (await waitForForkMusicPlayer(target(), 1)) return true;");
    expect(desktopMethod).toContain('AH_AHH_BUNDLE_ID = "dev.noey.ahahh"');
    expect(desktopMethod).toContain('["-g", "-j", "-b", AH_AHH_BUNDLE_ID]');
    expect(desktopPreload).toMatch(fenced('canOpen: clientPlatform === "darwin",'));
    expect(toggle).toContain("if (!open) void openMusic();");
    // The last panel to close ends the stream, a reloaded page counts as closed, nothing polls.
    expect(desktopMethod).toMatch(/if \(followers\.size > 0\) return;\s*stopStream\?\.\(\);/u);
    expect(desktopMethod).toContain('contents.on("did-start-navigation"');
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

  it("follows ah ahh, starts it only when asked, lists its library, and holds the slider through a drag", async () => {
    const commands: MusicCommand[] = [];
    const pages: string[] = [];
    const volumeAnswers: Array<(taken: boolean) => void> = [];
    const counts = { follows: 0, unfollows: 0, opens: 0, queueReads: 0 };
    let pushState: (state: MusicState) => void = () => undefined;
    const bridge: MusicBridge = {
      canOpen: true,
      follow: (listener) => {
        counts.follows += 1;
        pushState = listener;
        return () => {
          counts.unfollows += 1;
        };
      },
      open: () => {
        counts.opens += 1;
        return Promise.resolve(true);
      },
      command: (command) => {
        commands.push(command);
        return command.action === "volume"
          ? new Promise((resolve) => volumeAnswers.push(resolve))
          : Promise.resolve(true);
      },
      upNext: () => {
        counts.queueReads += 1;
        return Promise.resolve([{ index: 5, title: "Two", artist: "Artist" }]);
      },
      libraryPage: (path, offset) => {
        pages.push(`${path}@${offset}`);
        if (path === "/v1/me/library/playlists") {
          return Promise.resolve({
            rows: [{ id: "p.1", name: "Girlpop", artist: "" }],
            nextOffset: null,
          });
        }
        return Promise.resolve(
          offset === 0
            ? { rows: songs(100, 0), nextOffset: 100 }
            : { rows: songs(20, 100), nextOffset: null },
        );
      },
    };
    (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge = { music: bridge };
    const volumes = () =>
      commands.flatMap((command) => (command.action === "volume" ? [command.value] : []));
    try {
      // A mount follows; it never starts ah ahh. The button's click (or Open) is what does.
      const unsubscribe = subscribeMusic(() => undefined);
      pushState({ status: "closed" });
      expect(counts).toMatchObject({ follows: 1, opens: 0 });
      await openMusic();
      expect(counts.opens).toBe(1);
      expect(getMusicSnapshot()).toMatchObject({ opening: false, openFailed: false });

      pushState(ready(0.5));
      await vi.waitFor(() => expect(getMusicSnapshot().sources).toHaveLength(2));
      expect(getMusicSnapshot().sources).toEqual([
        { name: "Songs", path: "/v1/me/library/songs" },
        { name: "Girlpop", path: "/v1/me/library/playlists/p.1/tracks" },
      ]);
      expect(getMusicSnapshot().upNext).toEqual([{ index: 5, title: "Two", artist: "Artist" }]);

      const girlpop = getMusicSnapshot().sources?.[1];
      if (!girlpop) throw new Error("no playlist");
      await browseMusicSource(girlpop);
      expect(getMusicSnapshot().browsing?.tracks).toHaveLength(120);
      // By id: what plays is what the list shows, whatever the playlist has become since.
      playBrowsedTrack(7);
      const played = commands.at(-1);
      expect(played).toMatchObject({ action: "playSongs", value: { startWith: 7 } });
      expect(played?.action === "playSongs" ? played.value.ids : null).toHaveLength(120);

      // The same source opened twice in a row: the first listing stops, the second is the list.
      const before = pages.length;
      await Promise.all([browseMusicSource(girlpop), browseMusicSource(girlpop)]);
      expect(getMusicSnapshot().browsing?.tracks).toHaveLength(120);
      expect(pages.length - before).toBe(3);

      // A drag: the first value goes out, the ones behind it collapse to the last.
      setMusicVolume(0.1);
      setMusicVolume(0.2);
      setMusicVolume(0.3);
      // ah ahh reports a beat behind: the older value must not move the slider.
      pushState(ready(0.1));
      expect(getMusicSnapshot().sentVolume).toBe(0.3);
      volumeAnswers[0]?.(true);
      await vi.waitFor(() => expect(volumeAnswers).toHaveLength(2));
      // The report of the final value lands before its command is answered. That is enough
      // to let go: nothing else may ever arrive, since repeats of a state are not streamed.
      pushState(ready(0.3));
      expect(getMusicSnapshot().sentVolume).toBeNull();
      volumeAnswers[1]?.(true);
      pushState(ready(0.8));
      expect(getMusicSnapshot()).toMatchObject({ sentVolume: null, state: { volume: 0.8 } });
      // Set to what ah ahh already has, so no report follows: let go when the command is taken.
      setMusicVolume(0.8);
      expect(getMusicSnapshot().sentVolume).toBe(0.8);
      await vi.waitFor(() => expect(volumeAnswers).toHaveLength(3));
      volumeAnswers[2]?.(true);
      await vi.waitFor(() => expect(getMusicSnapshot().sentVolume).toBeNull());
      expect(volumes()).toEqual([0.1, 0.3, 0.8]);

      // A changed queue is read again. A closed ah ahh shows as that and is not restarted.
      const queueReads = counts.queueReads;
      pushState(ready(0.8, 2));
      expect(counts.queueReads).toBe(queueReads + 1);
      pushState({ status: "closed" });
      expect(getMusicSnapshot().state).toEqual({ status: "closed" });
      expect(counts.opens).toBe(1);

      // Try again follows afresh; the last panel to close stops following.
      retryMusic();
      expect(counts).toMatchObject({ follows: 2, unfollows: 1 });
      unsubscribe();
      expect(counts.unfollows).toBe(2);
    } finally {
      delete (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
    }
  });
});
