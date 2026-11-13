// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  commandForkMusic,
  followForkMusic,
  libraryPageForkMusic,
  upNextForkMusic,
  waitForForkMusicPlayer,
} from "./ForkMusicClient.ts";

const TOKEN = "pairing-token";
const ART = "https://is1-ssl.mzstatic.com/image/thumb/a.jpg/{w}x{h}bb.jpg";

/** What ah ahh's remoteState sends; the client keeps only what the panel shows. */
const player = (title: string, positionMs: number) => ({
  playing: true,
  title,
  artist: "Artist",
  album: "Album",
  artwork: null,
  durationMs: 200_000,
  positionMs,
  volume: 0.5,
  shuffle: false,
  repeat: 0 as const,
  queueRevision: 1,
  favorite: null,
});
const shown = (title: string, positionMs: number, positionAt: number) => ({
  status: "ready",
  positionAt,
  playing: true,
  title,
  artist: "Artist",
  album: "Album",
  artwork: null,
  durationMs: 200_000,
  positionMs,
  volume: 0.5,
  shuffle: false,
  repeat: 0,
  queueRevision: 1,
});

/** Values pushed by a callback, taken in order by a test that awaits each one. */
function inbox<T>() {
  const items: T[] = [];
  const waiters: Array<(value: T) => void> = [];
  return {
    push(value: T) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else items.push(value);
    },
    take: (): Promise<T> =>
      items.length > 0
        ? Promise.resolve(items.shift() as T)
        : new Promise((resolve) => waiters.push(resolve)),
  };
}

/** The slice of ah ahh's electron/remote.js this client speaks to. */
async function startAhAhh() {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "fork-music-"));
  const tokenFile = NodePath.join(directory, "remote.json");
  const bodies: unknown[] = [];
  let stream: NodeHttp.ServerResponse | null = null;
  const connected = inbox<void>();
  const server = NodeHttp.createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${TOKEN}`) {
      response.writeHead(401).end("{}");
      return;
    }
    if (request.url === "/v1/events") {
      response.writeHead(200, { "content-type": "text/event-stream" });
      stream = response;
      connected.push();
      return;
    }
    if (request.url === "/v1/queue") {
      const entry = (index: number) => ({
        index,
        id: `q${index}`,
        title: `Q${index}`,
        artist: "A",
        artwork: `https://is1-ssl.mzstatic.com/${index}/120x120bb.jpg`,
      });
      response.writeHead(200).end(JSON.stringify({ position: 4, items: [entry(4), entry(5)] }));
      return;
    }
    let text = "";
    request.on("data", (chunk) => (text += chunk));
    request.on("end", () => {
      const body = JSON.parse(text) as { action?: string; path?: string };
      bodies.push(body);
      if (request.url === "/v1/command") {
        response.writeHead(body.action === "refused" ? 400 : 204).end();
      } else if (body.path === "/empty") {
        response.writeHead(404).end("{}");
      } else if (body.path === "/garbled") {
        response.writeHead(200).end(JSON.stringify({ data: [{ id: 7 }] }));
      } else {
        response.writeHead(200).end(
          JSON.stringify({
            data: [
              {
                id: "i.1",
                type: "library-songs",
                attributes: { name: "One", artistName: "A", artwork: { url: ART } },
              },
              { id: "p.1", type: "library-playlists", attributes: { name: "Girlpop" } },
            ],
            ...(body.path === "/more" ? { next: "/more?offset=100" } : {}),
          }),
        );
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as NodeNet.AddressInfo;
  return {
    target: { origin: `http://127.0.0.1:${port}`, tokenFile },
    bodies,
    connected,
    pair: (token: string) => NodeFSP.writeFile(tokenFile, JSON.stringify({ token })),
    publish: (state: unknown) => stream?.write(`data: ${JSON.stringify(state)}\n\n`),
    endStream: () => stream?.end(),
    async [Symbol.asyncDispose]() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await NodeFSP.rm(directory, { recursive: true, force: true });
    },
  };
}

describe("ForkMusicClient", () => {
  it("answers typed values, and false or null instead of failing", async () => {
    await using ahAhh = await startAhAhh();
    const { target } = ahAhh;

    // ah ahh has never run on this computer: there is no token to read.
    expect(await upNextForkMusic(target)).toBeNull();
    expect(await waitForForkMusicPlayer(target, 1)).toBe(false);

    await ahAhh.pair(TOKEN);
    // What a launch waits on: the player answering for its queue.
    expect(await waitForForkMusicPlayer(target, 1)).toBe(true);
    // The first entry is the song playing; ids are not the panel's business.
    expect(await upNextForkMusic(target)).toEqual([
      {
        index: 5,
        title: "Q5",
        artist: "A",
        artwork: "https://is1-ssl.mzstatic.com/5/120x120bb.jpg",
      },
    ]);
    expect(await commandForkMusic(target, { action: "volume", value: 0.25 })).toBe(true);
    expect(await commandForkMusic(target, { action: "refused" })).toBe(false);

    expect(await libraryPageForkMusic(target, "/more", 200)).toEqual({
      rows: [
        { id: "i.1", name: "One", artist: "A", artwork: ART },
        { id: "p.1", name: "Girlpop", artist: "", artwork: null },
      ],
      nextOffset: 300,
    });
    // A playlist's cover is its first song's, so one row is asked for.
    expect((await libraryPageForkMusic(target, "/more", 0, 1))?.nextOffset).toBe(1);
    expect((await libraryPageForkMusic(target, "/last", 0))?.nextOffset).toBeNull();
    // Apple's 404 is how an empty playlist lists its tracks.
    expect(await libraryPageForkMusic(target, "/empty", 0)).toEqual({ rows: [], nextOffset: null });
    // An answer in the wrong shape is a failure, not a list with defaults filled in.
    expect(await libraryPageForkMusic(target, "/garbled", 0)).toBeNull();
    expect(ahAhh.bodies).toEqual([
      { action: "volume", value: 0.25 },
      { action: "refused" },
      { path: "/more", params: { limit: 100, offset: 200 } },
      { path: "/more", params: { limit: 1, offset: 0 } },
      { path: "/last", params: { limit: 100, offset: 0 } },
      { path: "/empty", params: { limit: 100, offset: 0 } },
      { path: "/garbled", params: { limit: 100, offset: 0 } },
    ]);

    // Reset pairing in ah ahh replaced the token, or nothing is listening at all.
    await ahAhh.pair("stale");
    expect(await upNextForkMusic(target)).toBeNull();
    const nowhere = { ...target, origin: "http://127.0.0.1:1" };
    expect(await commandForkMusic(nowhere, { action: "toggle" })).toBe(false);
    // A launch that never comes up gives up rather than waiting forever.
    expect(await waitForForkMusicPlayer(nowhere, 2, 0)).toBe(false);
  });

  it("streams state without the position heartbeat, and reports once when it ends", async () => {
    await using ahAhh = await startAhAhh();
    await ahAhh.pair(TOKEN);
    const states = inbox<unknown>();
    let clock = 0;
    const stop = followForkMusic(
      ahAhh.target,
      (state) => states.push(state),
      () => clock,
    );
    await ahAhh.connected.take();

    ahAhh.publish(player("One", 10));
    expect(await states.take()).toEqual(shown("One", 10, 0));
    // ah ahh re-sends every ten seconds to carry the position, which the panel advances itself.
    clock = 10_000;
    ahAhh.publish(player("One", 10_010));
    // A seek moves it further than the song played: that comes through.
    ahAhh.publish(player("One", 90_000));
    expect(await states.take()).toEqual(shown("One", 90_000, 10_000));
    ahAhh.publish(player("Two", 0));
    expect(await states.take()).toEqual(shown("Two", 0, 10_000));

    ahAhh.endStream();
    expect(await states.take()).toEqual({ status: "closed" });
    stop();

    // A refused stream is an error, not a closed ah ahh; so is a state in the wrong shape.
    await ahAhh.pair("stale");
    followForkMusic(ahAhh.target, (state) => states.push(state));
    expect(await states.take()).toEqual({ status: "error" });
    await ahAhh.pair(TOKEN);
    followForkMusic(ahAhh.target, (state) => states.push(state));
    await ahAhh.connected.take();
    ahAhh.publish({ title: 7 });
    expect(await states.take()).toEqual({ status: "error" });
  });
});
