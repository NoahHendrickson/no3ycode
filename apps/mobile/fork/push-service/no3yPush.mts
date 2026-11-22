// @effect-diagnostics nodeBuiltinImport:off
/** Fork-owned — see `.fork/customizations.yaml#no3y-push`. Pushes no3y iOS notifications from this Mac. */
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import * as NodeHttp2 from "node:http2";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { EnvironmentId, OrchestrationV2ShellStreamItem } from "@t3tools/contracts";
import {
  projectThreadAwarenessV2,
  type AgentAwarenessState,
  type ProjectThreadAwarenessV2Input,
} from "@t3tools/shared/agentAwareness";
import * as Schema from "effect/Schema";

const TEAM_ID = "4WDT6B6JDX";
const BUNDLE_ID = "com.noahhendrickson.no3ycode";
const SERVICE_PORT = 3781;
const MOUNT_PATH = "/no3y-push";
const LAUNCH_AGENT_LABEL = "com.noahhendrickson.no3y-push";
// Matches the official relay: a run can end just before its continuation starts.
const COMPLETION_SETTLE_MS = 5_000;
const NOTIFY_PHASES = new Set(["completed", "failed", "waiting_for_approval", "waiting_for_input"]);

const home = process.env.NO3Y_PUSH_HOME ?? NodePath.join(NodeOS.homedir(), ".no3y-push");
const configPath = NodePath.join(home, "config.json");
const devicesPath = NodePath.join(home, "devices.json");

type ApnsEnvironment = "production" | "development";

interface Config {
  readonly serverOrigin: string;
  readonly accessToken: string;
  readonly expiresAt: string | null;
}

interface Device {
  readonly token: string;
  readonly environment: ApnsEnvironment;
  readonly registeredAt: string;
}

export interface ApnsNotification {
  readonly title: string;
  readonly body: string;
  readonly environmentId: string;
  readonly threadId: string;
  readonly deepLink: string;
}

function log(message: string) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(NodeFS.readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writePrivateJson(path: string, value: unknown) {
  NodeFS.mkdirSync(home, { recursive: true, mode: 0o700 });
  NodeFS.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function readConfig(): Config {
  const config = readJson<Config | null>(configPath, null);
  if (!config) throw new Error(`Not paired yet. Run: node ${scriptPath()} pair '<pairing link>'`);
  return config;
}

function scriptPath() {
  return NodeURL.fileURLToPath(import.meta.url);
}

export function pairingTokenFromUrl(link: string): string | null {
  try {
    const url = new URL(link.trim());
    return new URLSearchParams(url.hash.slice(1)).get("token") ?? url.searchParams.get("token");
  } catch {
    return null;
  }
}

export function notificationForState(state: AgentAwarenessState): ApnsNotification {
  return {
    title: state.threadTitle,
    body: `${state.headline}: ${state.projectTitle}`,
    environmentId: state.environmentId,
    threadId: state.threadId,
    deepLink: state.deepLink,
  };
}

export function apnsPayload(notification: ApnsNotification) {
  return {
    aps: {
      alert: { title: notification.title, body: notification.body },
      sound: "default",
      "thread-id": `${notification.environmentId}/${notification.threadId}`,
    },
    // Expo exposes userInfo.body as notification data; the app's tap handler reads deepLink.
    body: {
      environmentId: notification.environmentId,
      threadId: notification.threadId,
      deepLink: notification.deepLink,
    },
  };
}

/** One alert per distinct wait or finish; the request id separates back-to-back approvals. */
export function alertKey(state: AgentAwarenessState | null, pendingRequestId: string | null) {
  if (state === null || !NOTIFY_PHASES.has(state.phase)) return null;
  return `${state.phase}:${pendingRequestId ?? ""}`;
}

function apnsKey(): { readonly keyId: string; readonly pem: string } {
  const file = NodeFS.readdirSync(home).find((name) => /^AuthKey_[A-Z0-9]+\.p8$/u.test(name));
  if (!file) throw new Error(`No AuthKey_<id>.p8 in ${home}`);
  return {
    keyId: file.slice("AuthKey_".length, -".p8".length),
    pem: NodeFS.readFileSync(NodePath.join(home, file), "utf8"),
  };
}

let cachedJwt: { readonly token: string; readonly issuedAt: number } | null = null;

function apnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  // APNs rejects tokens older than an hour and throttles ones refreshed too often.
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;
  const { keyId, pem } = apnsKey();
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: TEAM_ID, iat: now })}`;
  const signature = NodeCrypto.sign("sha256", Buffer.from(unsigned), {
    key: pem,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  cachedJwt = { token: `${unsigned}.${signature}`, issuedAt: now };
  return cachedJwt.token;
}

function sendToApns(
  device: Device,
  payload: unknown,
): Promise<{ readonly status: number; readonly reason: string | null }> {
  const host =
    device.environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";
  return new Promise((resolve, reject) => {
    const session = NodeHttp2.connect(host);
    session.on("error", reject);
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${device.token}`,
      authorization: `bearer ${apnsJwt()}`,
      "apns-topic": BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    request.on("response", (headers) => {
      status = Number(headers[":status"]);
    });
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
    });
    request.on("end", () => {
      session.close();
      let reason: string | null = null;
      try {
        reason = body ? ((JSON.parse(body) as { reason?: string }).reason ?? null) : null;
      } catch {
        reason = body;
      }
      resolve({ status, reason });
    });
    request.on("error", (error) => {
      session.close();
      reject(error);
    });
    request.end(JSON.stringify(payload));
  });
}

function readDevices(): Device[] {
  return readJson<{ devices: Device[] }>(devicesPath, { devices: [] }).devices;
}

function saveDevices(devices: ReadonlyArray<Device>) {
  writePrivateJson(devicesPath, { devices });
}

async function notifyAll(notification: ApnsNotification) {
  const payload = apnsPayload(notification);
  for (const device of readDevices()) {
    try {
      let result = await sendToApns(device, payload);
      // TestFlight tokens are production, Xcode-signed builds are sandbox; learn which on first send.
      if (result.status === 400 && result.reason === "BadDeviceToken") {
        const other: ApnsEnvironment =
          device.environment === "production" ? "development" : "production";
        const retried = await sendToApns({ ...device, environment: other }, payload);
        if (retried.status === 200) {
          saveDevices(
            readDevices().map((d) => (d.token === device.token ? { ...d, environment: other } : d)),
          );
        }
        result = retried;
      }
      if (result.status === 410) {
        saveDevices(readDevices().filter((d) => d.token !== device.token));
        log(`dropped unregistered device ${device.token.slice(0, 8)}…`);
      } else if (result.status !== 200) {
        log(`APNs ${result.status} ${result.reason ?? ""} for ${device.token.slice(0, 8)}…`);
      }
    } catch (error) {
      log(`APNs send failed: ${String(error)}`);
    }
  }
}

function startRegistrationServer() {
  const server = NodeHttp.createServer((request, response) => {
    const path = (request.url ?? "").replace(MOUNT_PATH, "") || "/";
    if (request.method === "GET" && path === "/health") {
      response.writeHead(200).end("ok");
      return;
    }
    if (request.method !== "POST" || path !== "/register") {
      response.writeHead(404).end();
      return;
    }
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      raw += chunk;
      if (raw.length > 4096) request.destroy();
    });
    request.on("end", () => {
      const token = parseToken(raw);
      if (token === null) {
        response.writeHead(400).end();
        return;
      }
      const devices = readDevices();
      if (!devices.some((device) => device.token === token)) {
        saveDevices([
          ...devices,
          { token, environment: "production", registeredAt: new Date().toISOString() },
        ]);
        log(`registered device ${token.slice(0, 8)}…`);
      }
      response.writeHead(204).end();
    });
  });
  server.listen(SERVICE_PORT, "127.0.0.1", () => log(`registration on :${SERVICE_PORT}`));
}

export function parseToken(raw: string): string | null {
  try {
    const token = (JSON.parse(raw) as { token?: unknown }).token;
    return typeof token === "string" && /^[0-9a-f]{64,200}$/iu.test(token) ? token : null;
  } catch {
    return null;
  }
}

const decodeItem = Schema.decodeUnknownSync(Schema.toCodecJson(OrchestrationV2ShellStreamItem));
const decodeEnvironmentId = Schema.decodeUnknownSync(EnvironmentId);

export interface Tracker {
  readonly environmentId: EnvironmentId;
  readonly notify: (notification: ApnsNotification) => void;
  readonly projectTitles: Map<string, string>;
  readonly lastKeys: Map<string, string | null>;
  readonly settleTimers: Map<string, ReturnType<typeof setTimeout>>;
}

type ThreadShell = Extract<OrchestrationV2ShellStreamItem, { kind: "thread.updated" }>["thread"];
type ObservedThread = ProjectThreadAwarenessV2Input["thread"] & Pick<ThreadShell, "projectId">;

function awareness(tracker: Tracker, thread: ObservedThread) {
  return projectThreadAwarenessV2({
    environmentId: tracker.environmentId,
    project: { title: tracker.projectTitles.get(thread.projectId) ?? "" },
    thread,
  });
}

export function observeThread(tracker: Tracker, thread: ObservedThread, silent: boolean) {
  const state = awareness(tracker, thread);
  const key = alertKey(state, thread.pendingRuntimeRequest?.id ?? null);
  const previous = tracker.lastKeys.get(thread.id) ?? null;
  tracker.lastKeys.set(thread.id, key);
  if (silent || key === null || key === previous || state === null) return;

  clearTimeout(tracker.settleTimers.get(thread.id));
  if (state.phase !== "completed") {
    tracker.notify(notificationForState(state));
    return;
  }
  tracker.settleTimers.set(
    thread.id,
    setTimeout(() => {
      tracker.settleTimers.delete(thread.id);
      if (tracker.lastKeys.get(thread.id) === key) tracker.notify(notificationForState(state));
    }, COMPLETION_SETTLE_MS),
  );
}

export function applyShellItem(tracker: Tracker, item: OrchestrationV2ShellStreamItem) {
  switch (item.kind) {
    case "snapshot": {
      for (const project of item.snapshot.projects)
        tracker.projectTitles.set(project.id, project.title);
      // A projects-only refresh arrives with no threads; the first snapshot sets the baseline.
      for (const thread of item.snapshot.threads) observeThread(tracker, thread, true);
      return;
    }
    case "project.updated":
      tracker.projectTitles.set(item.project.id, item.project.title);
      return;
    case "thread.updated":
      if (item.location === "active") observeThread(tracker, item.thread, false);
      return;
    case "thread.removed":
      tracker.lastKeys.delete(item.threadId);
      return;
    default:
      return;
  }
}

async function websocketTicket(config: Config): Promise<string> {
  const response = await fetch(new URL("/api/auth/websocket-ticket", config.serverOrigin), {
    method: "POST",
    headers: { authorization: `Bearer ${config.accessToken}` },
  });
  if (response.status === 401) throw new Error("Server rejected the token; pair again.");
  if (!response.ok) throw new Error(`websocket-ticket ${response.status}`);
  return ((await response.json()) as { ticket: string }).ticket;
}

async function environmentId(config: Config): Promise<EnvironmentId> {
  const response = await fetch(new URL("/.well-known/t3/environment", config.serverOrigin));
  return decodeEnvironmentId(((await response.json()) as { environmentId: unknown }).environmentId);
}

async function watchOnce(config: Config) {
  const tracker: Tracker = {
    environmentId: await environmentId(config),
    notify: (notification) => {
      log(`alert "${notification.body}" for ${notification.threadId}`);
      void notifyAll(notification);
    },
    projectTitles: new Map(),
    lastKeys: new Map(),
    settleTimers: new Map(),
  };
  const url = new URL("/ws", config.serverOrigin.replace(/^http/u, "ws"));
  url.searchParams.set("orchestrationProtocol", "2");
  url.searchParams.set("wsTicket", await websocketTicket(config));

  await new Promise<void>((resolve) => {
    const socket = new WebSocket(url);
    let ping: ReturnType<typeof setInterval> | undefined;
    socket.addEventListener("open", () => {
      log("watching thread activity");
      socket.send(
        JSON.stringify({
          _tag: "Request",
          id: "1",
          tag: "orchestration.subscribeShell",
          payload: {},
          headers: [],
        }),
      );
      ping = setInterval(() => socket.send(JSON.stringify({ _tag: "Ping" })), 30_000);
    });
    socket.addEventListener("message", (event) => {
      const parsed: unknown = JSON.parse(String(event.data));
      for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
        const tag = (message as { _tag?: string })._tag;
        if (tag === "Chunk") {
          for (const value of (message as { values: unknown[] }).values) {
            try {
              applyShellItem(tracker, decodeItem(value));
            } catch (error) {
              log(`skipped an item the schema did not accept: ${String(error).slice(0, 200)}`);
            }
          }
          // The server pauses the stream after a few unacknowledged chunks.
          socket.send(JSON.stringify({ _tag: "Ack", requestId: "1" }));
        } else if (tag === "Exit" || tag === "Defect") {
          socket.close();
        }
      }
    });
    socket.addEventListener("close", () => {
      clearInterval(ping);
      for (const timer of tracker.settleTimers.values()) clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => socket.close());
  });
}

// Server sessions do not slide, so the paired token simply ends; say so before alerts stop.
function warnIfPairingExpires() {
  const expiresAt = readJson<Partial<Config>>(configPath, {}).expiresAt;
  if (!expiresAt || Date.parse(expiresAt) - Date.now() > 3 * 24 * 60 * 60 * 1000) return;
  void notifyAll({
    title: "no3y push needs a new pairing link",
    body: "Create one in Settings → Sharing & access and pair the push service again.",
    environmentId: "",
    threadId: "",
    deepLink: "/",
  });
}

async function run() {
  startRegistrationServer();
  warnIfPairingExpires();
  setInterval(warnIfPairingExpires, 24 * 60 * 60 * 1000);
  let delayMs = 1_000;
  for (;;) {
    const startedAt = Date.now();
    try {
      await watchOnce(readConfig());
    } catch (error) {
      log(String(error));
    }
    delayMs = Date.now() - startedAt > 60_000 ? 1_000 : Math.min(delayMs * 2, 60_000);
    log(`reconnecting in ${delayMs / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function pair(link: string | undefined) {
  const token = link ? pairingTokenFromUrl(link) : null;
  if (!token) throw new Error("Pass the pairing link from Settings → Sharing & access.");
  const serverOrigin =
    readJson<{ origin?: string }>(
      NodePath.join(NodeOS.homedir(), ".t3-fork/userdata/server-runtime.json"),
      {},
    ).origin ?? "http://127.0.0.1:3773";
  const response = await fetch(new URL("/oauth/token", serverOrigin), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: token,
      subject_token_type: "urn:t3:params:oauth:token-type:environment-bootstrap",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "orchestration:read",
      client_label: "no3y push",
      client_device_type: "bot",
      client_os: "macOS",
    }),
  });
  if (!response.ok) throw new Error(`Pairing failed: ${response.status} ${await response.text()}`);
  const result = (await response.json()) as { access_token: string; expires_in: number };
  const expiresAt =
    result.expires_in > 0 ? new Date(Date.now() + result.expires_in * 1000).toISOString() : null;
  writePrivateJson(configPath, { serverOrigin, accessToken: result.access_token, expiresAt });
  log(`paired with ${serverOrigin}${expiresAt ? `; token expires ${expiresAt}` : ""}`);
}

function tailscale(args: ReadonlyArray<string>) {
  NodeChildProcess.execFileSync("tailscale", args, { stdio: "inherit" });
}

function launchAgentPath() {
  return NodePath.join(NodeOS.homedir(), "Library/LaunchAgents", `${LAUNCH_AGENT_LABEL}.plist`);
}

function install() {
  readConfig();
  apnsKey();
  const logPath = NodePath.join(home, "service.log");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${process.execPath}</string><string>${scriptPath()}</string><string>run</string></array>
  <key>WorkingDirectory</key><string>${NodePath.dirname(scriptPath())}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${logPath}</string>
  <key>StandardErrorPath</key><string>${logPath}</string>
</dict>
</plist>
`;
  uninstallLaunchAgent();
  NodeFS.writeFileSync(launchAgentPath(), plist);
  NodeChildProcess.execFileSync("launchctl", [
    "bootstrap",
    `gui/${process.getuid?.()}`,
    launchAgentPath(),
  ]);
  tailscale([
    "serve",
    "--bg",
    "--https=443",
    `--set-path=${MOUNT_PATH}`,
    `http://127.0.0.1:${SERVICE_PORT}`,
  ]);
  log(`installed; logs in ${logPath}`);
}

function uninstallLaunchAgent() {
  try {
    NodeChildProcess.execFileSync(
      "launchctl",
      ["bootout", `gui/${process.getuid?.()}/${LAUNCH_AGENT_LABEL}`],
      { stdio: "ignore" },
    );
  } catch {
    // Not loaded.
  }
  NodeFS.rmSync(launchAgentPath(), { force: true });
}

async function main(command: string | undefined, argument: string | undefined) {
  switch (command) {
    case "pair":
      return pair(argument);
    case "test":
      return notifyAll({
        title: "no3y Code",
        body: "Push notifications from your Mac are working.",
        environmentId: "",
        threadId: "",
        deepLink: "/",
      });
    case "run":
      return run();
    case "install":
      return install();
    case "uninstall":
      uninstallLaunchAgent();
      tailscale(["serve", "--https=443", `--set-path=${MOUNT_PATH}`, "off"]);
      return log("uninstalled");
    default:
      console.log("usage: node no3yPush.mts pair <link> | test | run | install | uninstall");
  }
}

if (import.meta.main) {
  main(process.argv[2], process.argv[3]).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
