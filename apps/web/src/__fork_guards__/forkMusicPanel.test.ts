// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard for .fork/customizations.yaml#fork-music-panel. Pins the joins a sync could
 * drop (two channels, the sidebar footer's button and strip) and runs the store against a fake
 * bridge. The desktop's client for ah ahh has its own test beside it.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it, vi } from "vite-plus/test";

import type { MusicBridge, MusicCommand, MusicState } from "../custom/music/musicBridge";
import { readMusicBridge } from "../custom/music/musicBridge";
import {
  closeMusicSource,
  getMusicSnapshot,
  openMusic,
  openMusicRow,
  playMusicRows,
  retryMusic,
  setMusicVolume,
  showMusicTab,
  subscribeMusic,
} from "../custom/music/musicStore";
import { migratePersistedRightPanelState } from "../rightPanelStore";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const desktopMethod = readSibling("../../../desktop/src/fork/ForkMusic.ts");
const desktopHandlers = readSibling("../../../desktop/src/ipc/DesktopIpcHandlers.ts");
const desktopPreload = readSibling("../../../desktop/src/preload.ts");
const rightPanelStore = readSibling("../rightPanelStore.ts");
const closedViewStore = readSibling("../closedViewStore.ts");
const sidebarChrome = readSibling("../components/sidebar/SidebarChrome.tsx");
const button = readSibling("../custom/music/SidebarMusicButton.tsx");
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
  durationMs: 200_000,
  positionMs: 0,
  positionAt: 0,
  volume,
  shuffle: false,
  repeat: 0,
  queueRevision,
});

const songs = (count: number, from: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `i.${from + i}`,
    name: `Song ${from + i}`,
    artist: "Artist",
    artwork: `https://art/${from + i}/{w}x{h}.jpg`,
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
    expect(button).toContain("if (!open) void openMusic();");
    // The last panel to close ends the stream, a reloaded page counts as closed, nothing polls.
    expect(desktopMethod).toMatch(/if \(followers\.size > 0\) return;\s*stopStream\?\.\(\);/u);
    expect(desktopMethod).toContain('contents.on("did-start-navigation"');
    expect(desktopMethod).not.toMatch(/setInterval|setTimeout/u);
  });

  it("is a strip above the sidebar footer, opened from a button beside Settings", () => {
    expect(sidebarChrome).toMatch(fenced("<SidebarMusicStrip />"));
    expect(sidebarChrome).toMatch(fenced("<SidebarMusicButton />"));
    // The strip sits directly above the footer's icon row, the button right after Settings.
    expect(sidebarChrome.indexOf("<SidebarMusicStrip />")).toBeLessThan(
      sidebarChrome.indexOf("<SidebarUtilityMenu hideUsage={hideUsage} />"),
    );
    expect(sidebarChrome.indexOf('label="Settings"')).toBeLessThan(
      sidebarChrome.indexOf("<SidebarMusicButton />"),
    );
    expect(button).toContain("if (readMusicBridge() === null) return null;");
  });

  it("retires the Music tab through the stores' own migrations", () => {
    // Versions bumped past upstream, so both stores migrate what was persisted with Music in it.
    expect(rightPanelStore).toMatch(fenced("const RIGHT_PANEL_STORAGE_VERSION = 15;"));
    expect(rightPanelStore).toMatch(fenced('if \\(kind === "music"\\) return \\[\\];'));
    expect(closedViewStore).toMatch(fenced("version: 3,"));
    // closedViewStore's migrate keeps only the kinds isClosedViewEntry knows, which no longer include it.
    expect(closedViewStore).not.toContain('case "music"');
    const { byThreadKey } = migratePersistedRightPanelState({
      byThreadKey: {
        showing: {
          isOpen: true,
          activeSurfaceId: "music",
          surfaces: [
            { id: "diff", kind: "diff" },
            { id: "music", kind: "music" },
          ],
        },
        alone: {
          isOpen: true,
          activeSurfaceId: "music",
          surfaces: [{ id: "music", kind: "music" }],
        },
      },
    });
    expect(byThreadKey.showing).toMatchObject({
      isOpen: true,
      activeSurfaceId: "diff",
      surfaces: [{ id: "diff", kind: "diff" }],
    });
    expect(byThreadKey.alone).toMatchObject({ isOpen: false, activeSurfaceId: null, surfaces: [] });
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
    let releaseAlbums: () => void = () => undefined;
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
        return Promise.resolve([{ index: 5, title: "Two", artist: "Artist", artwork: null }]);
      },
      libraryPage: (path, offset, limit) => {
        pages.push(`${path}@${offset}${limit === undefined ? "" : `/${limit}`}`);
        if (path === "/v1/me/library/playlists") {
          return Promise.resolve({
            rows: [
              { id: "p.1", name: "Girlpop", artist: "", artwork: null },
              { id: "p.2", name: "Apple's", artist: "", artwork: "https://art/p2/{w}x{h}.jpg" },
            ],
            nextOffset: null,
          });
        }
        if (path === "/v1/me/library/artists") {
          return Promise.resolve({
            rows: [
              { id: "r.1", name: "Kim", artist: "", artwork: null },
              { id: "r.2", name: "Prolific", artist: "", artwork: null },
            ],
            nextOffset: null,
          });
        }
        if (path === "/v1/me/library/artists/r.2/albums") {
          const albums = (count: number, from: number) =>
            Array.from({ length: count }, (_, i) => ({
              id: `l.${from + i}`,
              name: `Album ${from + i}`,
              artist: "",
              artwork: null,
            }));
          if (offset === 0) return Promise.resolve({ rows: albums(100, 100), nextOffset: 100 });
          return new Promise((resolve) => {
            releaseAlbums = () => resolve({ rows: albums(5, 200), nextOffset: null });
          });
        }
        if (path === "/v1/me/library/artists/r.1/albums") {
          return Promise.resolve({
            rows: [
              { id: "l.1", name: "Turn Off", artist: "", artwork: "https://art/l1/{w}x{h}.jpg" },
            ],
            nextOffset: null,
          });
        }
        if (limit === 1) return Promise.resolve({ rows: songs(1, 0), nextOffset: 1 });
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
      // Only the tab showing is read: the library's songs, page by page.
      const root = (tab: "songs" | "playlists" | "artists") => getMusicSnapshot().stacks[tab][0];
      await vi.waitFor(() => expect(root("songs").rows).toHaveLength(120));
      expect(pages).toEqual(["/v1/me/library/songs@0", "/v1/me/library/songs@100"]);
      expect(root("playlists").rows).toBeNull();
      expect(root("artists").rows).toBeNull();
      expect(getMusicSnapshot().upNext).toBeNull();
      expect(counts.queueReads).toBe(0);

      // A playlist without art of its own takes its first song's, read one row at a time.
      showMusicTab("playlists");
      await vi.waitFor(() =>
        expect(root("playlists").rows?.[0]?.artwork).toBe("https://art/0/{w}x{h}.jpg"),
      );
      expect(root("playlists").rows?.[1]?.artwork).toBe("https://art/p2/{w}x{h}.jpg");
      expect(pages).toContain("/v1/me/library/playlists/p.1/tracks@0/1");
      expect(pages).not.toContain("/v1/me/library/playlists/p.2/tracks@0/1");

      const girlpop = root("playlists").rows?.[0];
      if (!girlpop) throw new Error("no playlist");
      await openMusicRow(girlpop, "playlists");
      const tracks = getMusicSnapshot().stacks.playlists.at(-1)?.rows;
      expect(tracks).toHaveLength(120);
      // By id: what plays is what the list shows, whatever the playlist has become since.
      playMusicRows(tracks ?? [], 7);
      const played = commands.at(-1);
      expect(played).toMatchObject({ action: "playSongs", value: { startWith: 7 } });
      expect(played?.action === "playSongs" ? played.value.ids : null).toHaveLength(120);

      // The same source opened twice in a row: the first listing stops, the second is the list.
      closeMusicSource();
      const before = pages.length;
      await Promise.all([openMusicRow(girlpop, "playlists"), openMusicRow(girlpop, "playlists")]);
      expect(getMusicSnapshot().stacks.playlists).toHaveLength(2);
      expect(getMusicSnapshot().stacks.playlists[1]?.rows).toHaveLength(120);
      expect(pages.length - before).toBe(3);

      // An artist opens on its albums, an album on its songs, and back goes one level.
      showMusicTab("artists");
      await vi.waitFor(() => expect(root("artists").rows).toHaveLength(2));
      const [kim, prolific] = root("artists").rows ?? [];
      if (!kim || !prolific) throw new Error("no artists");
      await openMusicRow(kim, "artists");
      const album = getMusicSnapshot().stacks.artists.at(-1)?.rows?.[0];
      if (!album) throw new Error("no album");
      await openMusicRow(album, "albums");
      expect(getMusicSnapshot().stacks.artists.map((level) => level.source.lists)).toEqual([
        "artists",
        "albums",
        "songs",
      ]);
      closeMusicSource();
      expect(getMusicSnapshot().stacks.artists).toHaveLength(2);
      // Each tab keeps its own place.
      expect(getMusicSnapshot().stacks.playlists).toHaveLength(2);

      // An album opened while its artist's albums are still paging: the artist keeps reading.
      closeMusicSource();
      const prolificRead = openMusicRow(prolific, "artists");
      await vi.waitFor(() =>
        expect(getMusicSnapshot().stacks.artists.at(-1)?.rows).toHaveLength(100),
      );
      const first = getMusicSnapshot().stacks.artists.at(-1)?.rows?.[0];
      if (!first) throw new Error("no album");
      await openMusicRow(first, "albums");
      releaseAlbums();
      await prolificRead;
      closeMusicSource();
      expect(getMusicSnapshot().stacks.artists.at(-1)?.rows).toHaveLength(105);
      closeMusicSource();

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

      // The queue is read when Up Next shows, and again when it changes while it shows; a
      // change behind another tab waits for Up Next to show.
      pushState(ready(0.8, 2));
      expect(counts.queueReads).toBe(0);
      showMusicTab("upNext");
      await vi.waitFor(() =>
        expect(getMusicSnapshot().upNext).toEqual([
          { index: 5, title: "Two", artist: "Artist", artwork: null },
        ]),
      );
      pushState(ready(0.8, 3));
      expect(counts.queueReads).toBe(2);
      showMusicTab("songs");
      showMusicTab("upNext");
      expect(counts.queueReads).toBe(2);
      // A closed ah ahh shows as that and is not restarted.
      pushState({ status: "closed" });
      expect(getMusicSnapshot().state).toEqual({ status: "closed" });
      expect(counts.opens).toBe(1);

      // ah ahh back after a restart: a hidden tab's list is read again when it next shows, and
      // the playlist covers already found are not.
      const playlistReads = () => pages.filter((page) => page === "/v1/me/library/playlists@0");
      expect(playlistReads()).toHaveLength(1);
      pushState(ready(0.8, 3));
      showMusicTab("playlists");
      await vi.waitFor(() => expect(playlistReads()).toHaveLength(2));
      expect(pages.filter((page) => page.endsWith("/tracks@0/1"))).toHaveLength(1);
      showMusicTab("songs");
      pushState({ status: "closed" });

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
