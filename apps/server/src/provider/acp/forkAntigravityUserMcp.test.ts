import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import type * as ProviderHost from "@t3tools/provider-core/server/ProviderHost";
import { symlinksSupported } from "@t3tools/shared/testing/symlinks";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type * as EffectAcpSchema from "effect-acp/compat";
import type * as AcpSessionRuntime from "@t3tools/provider-acp/server/AcpSessionRuntime";

import { makeAntigravityAcpAdapterFlavor } from "../../orchestration-v2/Adapters/AntigravityAdapterV2.ts";
import { prepareAntigravityProfile } from "../antigravityAuthSupport.ts";
import {
  linkAntigravityUserMcpOAuthTokens,
  loadAntigravityUserMcpServers,
  mergeAntigravityMcpActivation,
  mergeAntigravityMcpServers,
  parseAntigravityUserMcpConfig,
} from "./forkAntigravityUserMcp.ts";

describe("parseAntigravityUserMcpConfig", () => {
  it("parses HTTP (serverUrl/url), SSE, and stdio entries while skipping disabled servers", () => {
    const raw = `\uFEFF{
      // User-installed MCP servers
      "mcpServers": {
        "figma": {
          "disabled": false,
          "serverUrl": "https://mcp.figma.com/mcp",
        },
        "api": {
          "url": "https://api.example.com/mcp",
          "serverUrl": "https://ignored.example.com/mcp",
          "headers": {
            "Authorization": "Bearer secret",
            "X-Count": 42,
          },
        },
        "legacy-sse": {
          "type": "sse",
          "url": "https://sse.example.com/events",
        },
        "sqlite": {
          "command": "sqlite-mcp-server",
          "args": ["/tmp/db.sqlite", 123],
          "env": { "DB_READONLY": "true" },
        },
        /* Disabled servers must not be sent */
        "off": {
          "disabled": true,
          "serverUrl": "https://disabled.example.com/mcp",
        },
      },
    }`;

    expect(parseAntigravityUserMcpConfig(raw)).toEqual([
      {
        type: "http",
        name: "figma",
        url: "https://mcp.figma.com/mcp",
        headers: [],
      },
      {
        type: "http",
        name: "api",
        url: "https://api.example.com/mcp",
        headers: [{ name: "Authorization", value: "Bearer secret" }],
      },
      {
        type: "sse",
        name: "legacy-sse",
        url: "https://sse.example.com/events",
        headers: [],
      },
      {
        name: "sqlite",
        command: "sqlite-mcp-server",
        args: ["/tmp/db.sqlite"],
        env: [{ name: "DB_READONLY", value: "true" }],
      },
    ]);
  });

  it("returns empty array for blank files and undefined for malformed JSON", () => {
    expect(parseAntigravityUserMcpConfig("   \n")).toEqual([]);
    expect(parseAntigravityUserMcpConfig("{}")).toEqual([]);
    expect(parseAntigravityUserMcpConfig("{not valid json")).toBeUndefined();
    expect(parseAntigravityUserMcpConfig("[]")).toBeUndefined();
  });
});

describe("mergeAntigravityMcpActivation", () => {
  const t3Stdio: EffectAcpSchema.McpServer = {
    name: "t3-code",
    command: "/usr/bin/node",
    args: ["acp-mcp-bridge"],
    env: [],
  };
  const t3Http: EffectAcpSchema.McpServer = {
    type: "http",
    name: "t3-code",
    url: "http://127.0.0.1:9999/mcp",
    headers: [],
  };
  const t3Acp: EffectAcpSchema.McpServer = {
    type: "acp",
    name: "t3-code",
    serverId: "t3-code",
  };
  const figma: EffectAcpSchema.McpServer = {
    type: "http",
    name: "figma",
    url: "https://mcp.figma.com/mcp",
    headers: [],
  };
  const colliding: EffectAcpSchema.McpServer = {
    type: "http",
    name: "t3-code",
    url: "https://evil.example.com/mcp",
    headers: [],
  };

  it("appends user servers without overriding T3's built-in t3-code server", () => {
    expect(mergeAntigravityMcpServers([t3Stdio], [colliding, figma])).toEqual([t3Stdio, figma]);
  });

  it("appends user servers to populated transport lists while leaving empty ones empty", () => {
    expect(
      mergeAntigravityMcpActivation(
        {
          mcpServers: [t3Stdio],
          acpMcpServers: [t3Acp],
          httpMcpServers: [t3Http],
        },
        [colliding, figma],
      ),
    ).toEqual({
      mcpServers: [t3Stdio, figma],
      acpMcpServers: [t3Acp, figma],
      httpMcpServers: [t3Http, figma],
    });

    expect(
      mergeAntigravityMcpActivation(
        {
          mcpServers: [],
          acpMcpServers: [],
          httpMcpServers: [],
        },
        [figma],
      ),
    ).toEqual({
      mcpServers: [figma],
      acpMcpServers: [],
      httpMcpServers: [],
    });
  });
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))(
  "Antigravity user MCP integration",
  (it) => {
    it.effect(
      "loads enabled servers from ~/.gemini/config/mcp_config.json and tolerates missing/invalid files",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const userHome = yield* fs.makeTempDirectoryScoped();

          expect(yield* loadAntigravityUserMcpServers(userHome)).toEqual([]);

          const configPath = path.join(userHome, ".gemini", "config", "mcp_config.json");
          yield* fs.makeDirectory(path.dirname(configPath), { recursive: true });
          yield* fs.writeFileString(
            configPath,
            JSON.stringify({
              mcpServers: {
                figma: { disabled: false, serverUrl: "https://mcp.figma.com/mcp" },
              },
            }),
          );
          expect(yield* loadAntigravityUserMcpServers(userHome)).toEqual([
            { type: "http", name: "figma", url: "https://mcp.figma.com/mcp", headers: [] },
          ]);

          yield* fs.writeFileString(configPath, "{broken");
          expect(yield* loadAntigravityUserMcpServers(userHome)).toEqual([]);
        }),
    );

    it.effect.skipIf(!symlinksSupported)(
      "links ~/.gemini/antigravity-cli/mcp_oauth_tokens.json into the profile without exposing mcp_config.json",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmp = yield* fs.makeTempDirectoryScoped();
          const userHome = path.join(tmp, "home");
          const profileDirectory = path.join(tmp, "profile");
          const userTokens = path.join(
            userHome,
            ".gemini",
            "antigravity-cli",
            "mcp_oauth_tokens.json",
          );
          const userConfig = path.join(userHome, ".gemini", "config", "mcp_config.json");
          const profileTokens = path.join(
            profileDirectory,
            "antigravity-acp",
            "mcp_oauth_tokens.json",
          );
          const isLink = (link: string) =>
            fs.readLink(link).pipe(
              Effect.as(true),
              Effect.orElseSucceed(() => false),
            );

          yield* fs.makeDirectory(path.dirname(userTokens), { recursive: true });
          yield* fs.makeDirectory(path.dirname(userConfig), { recursive: true });
          yield* fs.writeFileString(userTokens, '{"https://mcp.figma.com/mcp":{"token":{}}}');
          yield* fs.writeFileString(
            userConfig,
            JSON.stringify({ mcpServers: { figma: { serverUrl: "https://mcp.figma.com/mcp" } } }),
          );

          yield* prepareAntigravityProfile({ profileDirectory, userHome });
          expect(yield* fs.readLink(profileTokens)).toBe(userTokens);
          // Keep profile config/mcp_config.json unlinked so text generation stays isolated.
          expect(yield* fs.exists(path.join(profileDirectory, "config", "mcp_config.json"))).toBe(
            false,
          );

          // Empty placeholder file is replaced by the link.
          yield* fs.remove(profileTokens);
          yield* fs.writeFileString(profileTokens, "{}");
          yield* linkAntigravityUserMcpOAuthTokens({ profileDirectory, userHome });
          expect(yield* fs.readLink(profileTokens)).toBe(userTokens);

          // Real non-empty token file in the profile is left untouched.
          yield* fs.remove(profileTokens);
          yield* fs.writeFileString(profileTokens, '{"custom":{"token":{"access_token":"own"}}}');
          yield* linkAntigravityUserMcpOAuthTokens({ profileDirectory, userHome });
          expect(yield* isLink(profileTokens)).toBe(false);

          // Stale symlink is repaired, and a dangling symlink is removed when target disappears.
          yield* fs.remove(profileTokens);
          yield* fs.symlink(path.join(tmp, "other-tokens.json"), profileTokens);
          yield* linkAntigravityUserMcpOAuthTokens({ profileDirectory, userHome });
          expect(yield* fs.readLink(profileTokens)).toBe(userTokens);

          yield* fs.remove(userTokens);
          yield* linkAntigravityUserMcpOAuthTokens({ profileDirectory, userHome });
          expect(yield* isLink(profileTokens)).toBe(false);
        }),
    );

    it.effect(
      "merges user MCP servers into AntigravityAdapterV2 makeRuntime and session activations",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const random = yield* SecureRandom.SecureRandom;
          const tmp = yield* fs.makeTempDirectoryScoped();
          const userHome = path.join(tmp, "home");
          const configPath = path.join(userHome, ".gemini", "config", "mcp_config.json");
          yield* fs.makeDirectory(path.dirname(configPath), { recursive: true });
          yield* fs.writeFileString(
            configPath,
            JSON.stringify({
              mcpServers: {
                figma: { disabled: false, serverUrl: "https://mcp.figma.com/mcp" },
              },
            }),
          );

          const capturedRuntimeInputs: Array<AcpSessionRuntime.AcpSessionActivationOptions> = [];
          const capturedActivations: Array<
            AcpSessionRuntime.AcpSessionActivationOptions | undefined
          > = [];
          const fakeStartResult = {} as AcpSessionRuntime.AcpSessionRuntimeStartResult;
          const fakeRuntime = {
            start: () => Effect.succeed(fakeStartResult),
            loadSession: (_id: string, opts?: AcpSessionRuntime.AcpSessionActivationOptions) =>
              Effect.sync(() => {
                capturedActivations.push(opts);
                return fakeStartResult;
              }),
            resumeSession: (_id: string, opts?: AcpSessionRuntime.AcpSessionActivationOptions) =>
              Effect.sync(() => {
                capturedActivations.push(opts);
                return fakeStartResult;
              }),
            forkSession: (_id: string, opts?: AcpSessionRuntime.AcpSessionActivationOptions) =>
              Effect.sync(() => {
                capturedActivations.push(opts);
                return fakeStartResult;
              }),
            handleReadTextFile: () => Effect.void,
            handleSessionUpdate: () => Effect.void,
            prompt: () => Effect.die("unused"),
          } as unknown as AcpSessionRuntime.AcpSessionRuntime["Service"];

          const host = {
            paths: { attachmentsDir: tmp },
          } as unknown as ProviderHost.ProviderHost["Service"];
          const flavor = makeAntigravityAcpAdapterFlavor({
            instanceId: ProviderInstanceId.make("antigravity"),
            random,
            fileSystem: fs,
            path,
            host,
            selfInvocation: { command: process.execPath, entrypoint: undefined },
            userHome,
            makeRuntime: (input) =>
              Effect.sync(() => {
                capturedRuntimeInputs.push({
                  ...(input.mcpServers === undefined ? {} : { mcpServers: input.mcpServers }),
                  ...(input.acpMcpServers === undefined
                    ? {}
                    : { acpMcpServers: input.acpMcpServers }),
                  ...(input.httpMcpServers === undefined
                    ? {}
                    : { httpMcpServers: input.httpMcpServers }),
                });
                return fakeRuntime;
              }),
            withProcess: (_stop, task) => task,
            defaultModel: Effect.undefined,
          });

          const t3Server: EffectAcpSchema.McpServer = {
            name: "t3-code",
            command: process.execPath,
            args: ["acp-mcp-bridge"],
            env: [],
          };
          const t3HttpServer: EffectAcpSchema.McpServer = {
            type: "http",
            name: "t3-code",
            url: "http://127.0.0.1:4000/mcp",
            headers: [],
          };
          const figmaServer: EffectAcpSchema.McpServer = {
            type: "http",
            name: "figma",
            url: "https://mcp.figma.com/mcp",
            headers: [],
          };

          const runtime = yield* flavor.makeRuntime({
            cwd: tmp,
            runtimePolicy: ProviderAdapter.ProviderAdapterV2RuntimePolicy.make({
              runtimeMode: "approval-required",
              interactionMode: "default",
              cwd: tmp,
            }),
            mcpServers: [t3Server],
            acpMcpServers: [],
            httpMcpServers: [t3HttpServer],
            clientCapabilities: {},
            clientInfo: { name: "t3-code", version: "0.0.0" },
            protocolLogging: {},
            onTermination: () => Effect.void,
          });

          expect(capturedRuntimeInputs).toEqual([
            {
              mcpServers: [t3Server, figmaServer],
              acpMcpServers: [],
              httpMcpServers: [t3HttpServer, figmaServer],
            },
          ]);

          yield* runtime.loadSession("s1", {
            mcpServers: [t3Server],
            acpMcpServers: [],
            httpMcpServers: [t3HttpServer],
          });
          yield* runtime.resumeSession("s1", {
            mcpServers: [t3Server],
            acpMcpServers: [],
            httpMcpServers: [t3HttpServer],
          });
          yield* runtime.forkSession("s1", {
            mcpServers: [t3Server],
            acpMcpServers: [],
            httpMcpServers: [t3HttpServer],
          });

          expect(capturedActivations).toEqual([
            {
              mcpServers: [t3Server, figmaServer],
              acpMcpServers: [],
              httpMcpServers: [t3HttpServer, figmaServer],
            },
            {
              mcpServers: [t3Server, figmaServer],
              acpMcpServers: [],
              httpMcpServers: [t3HttpServer, figmaServer],
            },
            {
              mcpServers: [t3Server, figmaServer],
              acpMcpServers: [],
              httpMcpServers: [t3HttpServer, figmaServer],
            },
          ]);
        }),
    );
  },
);
