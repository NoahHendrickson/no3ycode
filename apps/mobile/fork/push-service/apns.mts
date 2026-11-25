// @effect-diagnostics nodeBuiltinImport:off
/** Fork-owned — see `.fork/customizations.yaml#no3y-push`. APNs plumbing shared by alerts and the Live Activity. */
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeHttp2 from "node:http2";
import * as NodePath from "node:path";

import { NO3Y_APPLE_TEAM_ID } from "../no3yConstants.ts";

export type ApnsEnvironment = "production" | "development";

export interface PushToken {
  readonly token: string;
  readonly environment: ApnsEnvironment;
  /** The app's bundle ID; tokens registered before topics were sent are production. */
  readonly topic?: string;
  readonly registeredAt: string;
}

export interface ApnsRequest {
  readonly pushType: "alert" | "liveactivity";
  readonly topic: string;
  readonly priority: "5" | "10";
  readonly payload: unknown;
}

/** `gone`: APNs says the token is dead and the store has dropped it. */
export type Delivery = "sent" | "gone" | "failed";

/** One JSON file of tokens. `update` reads and writes synchronously, so no write can interleave. */
export interface TokenStore {
  readonly read: () => PushToken[];
  readonly update: (change: (tokens: PushToken[]) => PushToken[]) => void;
}

export function tokenStore(path: string): TokenStore {
  const read = (): PushToken[] => {
    try {
      return (JSON.parse(NodeFS.readFileSync(path, "utf8")) as { devices: PushToken[] }).devices;
    } catch {
      return [];
    }
  };
  return {
    read,
    update: (change) => {
      NodeFS.mkdirSync(NodePath.dirname(path), { recursive: true, mode: 0o700 });
      NodeFS.writeFileSync(path, `${JSON.stringify({ devices: change(read()) }, null, 2)}\n`, {
        mode: 0o600,
      });
    },
  };
}

export function apnsKey(home: string): { readonly keyId: string; readonly pem: string } {
  const file = NodeFS.readdirSync(home).find((name) => /^AuthKey_[A-Z0-9]+\.p8$/u.test(name));
  if (!file) throw new Error(`No AuthKey_<id>.p8 in ${home}`);
  return {
    keyId: file.slice("AuthKey_".length, -".p8".length),
    pem: NodeFS.readFileSync(NodePath.join(home, file), "utf8"),
  };
}

export function makeApnsClient(input: {
  readonly home: string;
  readonly log: (message: string) => void;
}) {
  let cachedJwt: { readonly token: string; readonly issuedAt: number } | null = null;

  const jwt = (): string => {
    const now = Math.floor(Date.now() / 1000);
    // APNs rejects tokens older than an hour and throttles ones refreshed too often.
    if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.token;
    const { keyId, pem } = apnsKey(input.home);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: NO3Y_APPLE_TEAM_ID, iat: now })}`;
    const signature = NodeCrypto.sign("sha256", Buffer.from(unsigned), {
      key: pem,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    cachedJwt = { token: `${unsigned}.${signature}`, issuedAt: now };
    return cachedJwt.token;
  };

  const send = (
    token: PushToken,
    apns: ApnsRequest,
  ): Promise<{ readonly status: number; readonly reason: string | null }> => {
    const host =
      token.environment === "production"
        ? "https://api.push.apple.com"
        : "https://api.sandbox.push.apple.com";
    return new Promise((resolve, reject) => {
      const session = NodeHttp2.connect(host);
      session.on("error", reject);
      const request = session.request({
        ":method": "POST",
        ":path": `/3/device/${token.token}`,
        authorization: `bearer ${jwt()}`,
        "apns-topic": apns.topic,
        "apns-push-type": apns.pushType,
        "apns-priority": apns.priority,
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
      request.end(JSON.stringify(apns.payload));
    });
  };

  /** Sends one push, learning the token's APNs environment and dropping it once APNs says it is gone. */
  const deliver = async (
    store: TokenStore,
    token: PushToken,
    apns: ApnsRequest,
  ): Promise<Delivery> => {
    try {
      let result = await send(token, apns);
      // TestFlight tokens are production, Xcode-signed builds are sandbox; learn which on first send.
      if (result.status === 400 && result.reason === "BadDeviceToken") {
        const other: ApnsEnvironment =
          token.environment === "production" ? "development" : "production";
        const retried = await send({ ...token, environment: other }, apns);
        if (retried.status === 200) {
          store.update((tokens) =>
            tokens.map((t) => (t.token === token.token ? { ...t, environment: other } : t)),
          );
        }
        result = retried;
      }
      if (result.status === 200) return "sent";
      if (result.status === 410) {
        store.update((tokens) => tokens.filter((t) => t.token !== token.token));
        input.log(`dropped unregistered ${apns.pushType} token ${token.token.slice(0, 8)}…`);
        return "gone";
      }
      input.log(`APNs ${result.status} ${result.reason ?? ""} for ${token.token.slice(0, 8)}…`);
    } catch (error) {
      input.log(`APNs send failed: ${String(error)}`);
    }
    return "failed";
  };

  return { deliver };
}
