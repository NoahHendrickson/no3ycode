// @effect-diagnostics-next-line nodeBuiltinImport:off - Effect's symlink has no type argument, and Windows needs "file" to link without ambiguity.
import * as NodeFSP from "node:fs/promises";

import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import type * as EffectAcpSchema from "effect-acp/compat";
import type * as AcpSessionRuntime from "@t3tools/provider-acp/server/AcpSessionRuntime";

const MAX_MCP_CONFIG_BYTES = 512 * 1024;

class AntigravityMcpOAuthLinkError extends Schema.TaggedError<AntigravityMcpOAuthLinkError>()(
  "AntigravityMcpOAuthLinkError",
  { link: Schema.String, cause: Schema.Defect() },
) {
  override get message(): string {
    return `Could not link Antigravity user MCP OAuth tokens at ${this.link}.`;
  }
}

/** Strip JSONC comments (`//`, `/* ... *\/`) and trailing commas outside string literals. */
function stripJsonc(raw: string): string {
  const input = raw.startsWith("\uFEFF") ? raw.slice(1) : raw;
  let withoutComments = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (inString) {
      withoutComments += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      withoutComments += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < input.length && input[i] !== "\n" && input[i] !== "\r") {
        i += 1;
      }
      if (i < input.length) {
        withoutComments += input[i]!;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) {
        i += 1;
      }
      i += 1;
      continue;
    }
    withoutComments += ch;
  }

  let output = "";
  inString = false;
  escaped = false;
  for (let i = 0; i < withoutComments.length; i += 1) {
    const ch = withoutComments[i]!;
    if (inString) {
      output += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      output += ch;
      continue;
    }
    if (ch === ",") {
      let lookahead = i + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead]!)) {
        lookahead += 1;
      }
      const follower = withoutComments[lookahead];
      if (follower === "}" || follower === "]") {
        continue;
      }
    }
    output += ch;
  }
  return output;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Predicate.isObject(value) && !Array.isArray(value);
}

function stringEntries(value: unknown): Array<{ readonly name: string; readonly value: string }> {
  if (!isPlainRecord(value)) return [];
  const entries: Array<{ readonly name: string; readonly value: string }> = [];
  for (const [name, entryValue] of Object.entries(value)) {
    if (typeof entryValue === "string") {
      entries.push({ name, value: entryValue });
    }
  }
  return entries;
}

/**
 * Parse Antigravity's `~/.gemini/config/mcp_config.json` into ACP `McpServer` entries.
 * Returns `undefined` when the file is not valid JSONC or does not hold a root object.
 */
export function parseAntigravityUserMcpConfig(
  raw: string,
): ReadonlyArray<EffectAcpSchema.McpServer> | undefined {
  const stripped = stripJsonc(raw).trim();
  if (stripped.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return undefined;
  }
  if (!isPlainRecord(parsed)) return undefined;
  if (parsed.mcpServers === undefined) return [];
  if (!isPlainRecord(parsed.mcpServers)) return undefined;

  const servers: Array<EffectAcpSchema.McpServer> = [];
  for (const [name, rawEntry] of Object.entries(parsed.mcpServers)) {
    if (!name.trim() || !isPlainRecord(rawEntry)) continue;
    if (rawEntry.disabled === true) continue;

    const rawUrl =
      typeof rawEntry.url === "string" && rawEntry.url.trim().length > 0
        ? rawEntry.url.trim()
        : typeof rawEntry.serverUrl === "string" && rawEntry.serverUrl.trim().length > 0
          ? rawEntry.serverUrl.trim()
          : undefined;
    if (rawUrl !== undefined) {
      const headers = stringEntries(rawEntry.headers);
      servers.push({
        type: rawEntry.type === "sse" ? "sse" : "http",
        name,
        url: rawUrl,
        headers,
      });
      continue;
    }

    const command = typeof rawEntry.command === "string" ? rawEntry.command.trim() : "";
    if (command.length > 0) {
      const args = Array.isArray(rawEntry.args)
        ? rawEntry.args.filter((arg): arg is string => typeof arg === "string")
        : [];
      const env = stringEntries(rawEntry.env);
      servers.push({
        name,
        command,
        args,
        env,
      });
    }
  }
  return servers;
}

/**
 * Load enabled user MCP servers from `~/.gemini/config/mcp_config.json`.
 * Best-effort: missing or invalid files never block an Antigravity session.
 */
export const loadAntigravityUserMcpServers = Effect.fn("loadAntigravityUserMcpServers")(function* (
  userHome: string,
): Effect.fn.Return<
  ReadonlyArray<EffectAcpSchema.McpServer>,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configPath = path.join(userHome, ".gemini", "config", "mcp_config.json");
  return yield* Effect.gen(function* () {
    const info = yield* fs
      .stat(configPath)
      .pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.undefined));
    if (info === undefined) return [];
    if (info.type !== "File" || info.size > BigInt(MAX_MCP_CONFIG_BYTES)) {
      yield* Effect.logWarning(
        "Skipping Antigravity user mcp_config.json (unsupported size/type).",
        {
          configPath,
        },
      );
      return [];
    }
    const raw = yield* fs.readFileString(configPath);
    const parsed = parseAntigravityUserMcpConfig(raw);
    if (parsed === undefined) {
      yield* Effect.logWarning("Could not parse Antigravity user mcp_config.json.", {
        configPath,
      });
      return [];
    }
    return parsed;
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning("Could not load Antigravity user mcp_config.json.", {
        configPath,
        error,
      }).pipe(Effect.as([] as ReadonlyArray<EffectAcpSchema.McpServer>)),
    ),
  );
});

/** Append user MCP servers without overriding any server already configured by T3 (e.g. `t3-code`). */
export function mergeAntigravityMcpServers(
  base: ReadonlyArray<EffectAcpSchema.McpServer> | undefined,
  userServers: ReadonlyArray<EffectAcpSchema.McpServer>,
): ReadonlyArray<EffectAcpSchema.McpServer> {
  const existing = base ?? [];
  if (userServers.length === 0) return existing;
  const seen = new Set(existing.map((server) => server.name));
  const additions = userServers.filter((server) => !seen.has(server.name));
  return additions.length === 0 ? existing : [...existing, ...additions];
}

/**
 * Merge user MCP servers into ACP session activation options.
 * Only appends to `acpMcpServers` / `httpMcpServers` when T3 populated them, so transport fallback
 * to `mcpServers` stays intact when T3's own MCP server is disabled.
 */
export function mergeAntigravityMcpActivation(
  activation: AcpSessionRuntime.AcpSessionActivationOptions,
  userServers: ReadonlyArray<EffectAcpSchema.McpServer>,
): AcpSessionRuntime.AcpSessionActivationOptions {
  if (userServers.length === 0) return activation;
  return {
    mcpServers: mergeAntigravityMcpServers(activation.mcpServers, userServers),
    ...(activation.acpMcpServers === undefined
      ? {}
      : {
          acpMcpServers:
            activation.acpMcpServers.length > 0
              ? mergeAntigravityMcpServers(activation.acpMcpServers, userServers)
              : activation.acpMcpServers,
        }),
    ...(activation.httpMcpServers === undefined
      ? {}
      : {
          httpMcpServers:
            activation.httpMcpServers.length > 0
              ? mergeAntigravityMcpServers(activation.httpMcpServers, userServers)
              : activation.httpMcpServers,
        }),
  };
}

/**
 * Link `~/.gemini/antigravity-cli/mcp_oauth_tokens.json` into the isolated profile's
 * `antigravity-acp/mcp_oauth_tokens.json` so OAuth-authenticated MCP servers (such as Figma)
 * authenticate and keep refreshed tokens in sync with the `agy` CLI.
 */
export const linkAntigravityUserMcpOAuthTokens = Effect.fn("linkAntigravityUserMcpOAuthTokens")(
  function* (input: {
    readonly profileDirectory: string;
    readonly userHome: string;
  }): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const target = path.join(input.userHome, ".gemini", "antigravity-cli", "mcp_oauth_tokens.json");
    const link = path.join(input.profileDirectory, "antigravity-acp", "mcp_oauth_tokens.json");

    yield* Effect.gen(function* () {
      const targetInfo = yield* fs
        .stat(target)
        .pipe(Effect.catchReason("PlatformError", "NotFound", () => Effect.undefined));
      if (targetInfo === undefined || targetInfo.type !== "File") {
        const linked = yield* fs.readLink(link).pipe(
          Effect.as(true),
          Effect.orElseSucceed(() => false),
        );
        if (linked) yield* fs.remove(link);
        return;
      }

      const existing = yield* fs.readLink(link).pipe(
        Effect.map((value): string | undefined => path.resolve(path.dirname(link), value)),
        Effect.catchReason("PlatformError", "NotFound", () => Effect.undefined),
        // Leave real non-empty token files untouched; replace only an empty placeholder.
        Effect.catch((error) =>
          Effect.gen(function* () {
            const info = yield* fs.stat(link);
            if (info.type !== "File" || info.size > 16n) {
              return yield* error;
            }
            const trimmed = (yield* fs.readFileString(link)).trim();
            if (trimmed !== "" && trimmed !== "{}") {
              return yield* error;
            }
            yield* fs.remove(link);
            return undefined;
          }),
        ),
      );
      if (existing === path.resolve(target)) return;
      if (existing !== undefined) {
        yield* fs.remove(link);
      }
      yield* fs.makeDirectory(path.dirname(link), { recursive: true });
      yield* Effect.tryPromise({
        try: () => NodeFSP.symlink(target, link, "file"),
        catch: (cause) => new AntigravityMcpOAuthLinkError({ link, cause }),
      });
    }).pipe(
      Effect.catch((error) =>
        Effect.logWarning("Antigravity user MCP OAuth tokens are not linked into the profile.", {
          link,
          target,
          error,
        }),
      ),
    );
  },
);
