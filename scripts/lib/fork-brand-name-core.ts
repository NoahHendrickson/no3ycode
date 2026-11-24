/**
 * Fork display-name rewrite — see `.fork/customizations.yaml#fork-brand-name`.
 *
 * Bundler-free so the Vite plugin (fork-brand-name.ts) and the Metro transformer
 * (apps/mobile/fork/forkBrandNameTransformer.cjs) share it; keep it import-free.
 */

export const FORK_DISPLAY_NAME = "no3y Code";

/**
 * Phrases that name something other than this app, kept exactly as written.
 * Every other "T3 <word>" names the app and becomes "no3y <word>".
 */
export const PRESERVED_PHRASES = [
  // The fork's credit, and prose about upstream itself.
  "Fork of T3 Code",
  "fork of T3 Code",
  "upstream T3 Code",
  // The Linux capture extension ships under its upstream name.
  "T3 Code SnapShots",
  "T3 Code GNOME extension",
  "T3 Code extension",
  // Upstream's registered GitHub App, whose install URL still names it.
  "T3 Code for GitHub",
  // The server issues peer-link sessions as "T3 Code · <label>"; a revoke prompt quotes it.
  "T3 Code · …",
  // Ping's hosted services and accounts.
  "T3 Connect",
  "T3 Chat",
  "T3 Account",
  "T3 account",
  // The server and its data directory keep their names; the client also matches server text
  // such as "Unable to connect to the T3 server WebSocket".
  "T3 server",
  "T3 Server",
  "T3 home",
] as const;

/** Modules whose "T3 Code" strings are identities (legacy profile names). */
export const EXCLUDED_MODULES = [/\/apps\/desktop\/src\/app\/DesktopUserData\.ts$/u] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
// Preserved phrases are tried first at each position. A bare "T3 " must start a word (or follow
// a \n, \r or \t escape in source text) and precede a letter, so `const T3 = …` stays untouched.
const PRESERVED_OR_NAME = new RegExp(
  [...PRESERVED_PHRASES.map(escapeRegExp), "(?:(?<![\\w$])|(?<=\\\\[nrt]))T3 (?=[A-Za-z])"].join(
    "|",
  ),
  "gu",
);

export function rewriteUpstreamDisplayName(code: string): string | null {
  if (!code.includes("T3 ")) {
    return null;
  }
  const rewritten = code.replace(PRESERVED_OR_NAME, (match) => (match === "T3 " ? "no3y " : match));
  return rewritten === code ? null : rewritten;
}

const SCRIPT_MODULE = /\.[cm]?[jt]sx?$/u;

/** Whether a bundled module's source gets the rewrite: app scripts, never dependencies. */
export function isRebrandedModule(id: string): boolean {
  const path = (id.split("?", 1)[0] ?? id).replaceAll("\\", "/");
  return (
    SCRIPT_MODULE.test(path) &&
    // Metro passes project-relative paths, so a dependency can start with "node_modules/".
    !/(?:^|\/)node_modules\//u.test(path) &&
    !EXCLUDED_MODULES.some((pattern) => pattern.test(path))
  );
}
