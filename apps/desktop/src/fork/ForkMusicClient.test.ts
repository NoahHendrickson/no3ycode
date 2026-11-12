// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeHttp from "node:http";
import type * as NodeNet from "node:net";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { followForkMusic, requestForkMusic, waitForForkMusicPlayer } from "./ForkMusicClient.ts";

const TOKEN = "pairing-token";

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
      response.writeHead(200).end(JSON.stringify({ position: 0, items: [{ index: 0 }] }));
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
      } else {
        response.writeHead(200).end(JSON.stringify({ data: [{ id: "p.1" }] }));
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
  it("relays requests, and answers closed or error instead of failing", async () => {
    await using ahAhh = await startAhAhh();
    const { target } = ahAhh;

    // ah ahh has never run on this computer: there is no token to read.
    expect(await requestForkMusic(target, { type: "queue" })).toEqual({ status: "closed" });

    await ahAhh.pair(TOKEN);
    expect(await requestForkMusic(target, { type: "queue" })).toEqual({
      queue: { position: 0, items: [{ index: 0 }] },
    });
    expect(
      await requestForkMusic(target, { type: "command", action: "volume", value: 0.25 }),
    ).toEqual({ ok: true });
    expect(await requestForkMusic(target, { type: "command", action: "refused" })).toEqual({
      ok: false,
    });
    expect(
      await requestForkMusic(target, { type: "music", path: "/list", params: { limit: 100 } }),
    ).toEqual({ data: { data: [{ id: "p.1" }] } });
    // Apple's 404 is how an empty playlist lists its tracks.
    expect(await requestForkMusic(target, { type: "music", path: "/empty" })).toEqual({
      data: null,
    });
    expect(ahAhh.bodies).toEqual([
      { action: "volume", value: 0.25 },
      { action: "refused" },
      { path: "/list", params: { limit: 100 } },
      { path: "/empty" },
    ]);

    // What a launch waits on: the player answering for its queue.
    expect(await waitForForkMusicPlayer(target, 1, 0)).toBe(true);

    // Reset pairing in ah ahh replaced the token: refused, not closed.
    await ahAhh.pair("stale");
    expect(await requestForkMusic(target, { type: "queue" })).toEqual({ status: "error" });

    // Nothing listening on the port: ah ahh is not running.
    expect(
      await requestForkMusic({ ...target, origin: "http://127.0.0.1:1" }, { type: "queue" }),
    ).toEqual({ status: "closed" });
    // A launch that never comes up gives up rather than waiting forever.
    expect(await waitForForkMusicPlayer({ ...target, origin: "http://127.0.0.1:1" }, 2, 0)).toBe(
      false,
    );
  });

  it("streams state without the position heartbeat, and reports closed once when it ends", async () => {
    await using ahAhh = await startAhAhh();
    await ahAhh.pair(TOKEN);
    const states = inbox<unknown>();
    const stop = followForkMusic(ahAhh.target, (state) => states.push(state));
    await ahAhh.connected.take();

    ahAhh.publish({ title: "One", positionMs: 10 });
    expect(await states.take()).toEqual({ status: "ready", title: "One", positionMs: 10 });
    // ah ahh re-sends every ten seconds to carry the position; the panel has no use for it.
    ahAhh.publish({ title: "One", positionMs: 10_010 });
    ahAhh.publish({ title: "Two", positionMs: 0 });
    expect(await states.take()).toEqual({ status: "ready", title: "Two", positionMs: 0 });

    ahAhh.endStream();
    expect(await states.take()).toEqual({ status: "closed" });
    stop();
  });
});
