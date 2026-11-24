/**
 * Fork display-name rewrite — see `.fork/customizations.yaml#fork-brand-name`.
 *
 * Upstream writes "T3 Code" inline in hundreds of strings and adds more every
 * sync. Rewriting them at build time keeps every one of those files untouched,
 * so the brand stays consistent without a conflict surface the size of the app.
 */

import type { Plugin } from "vite-plus";

export const FORK_DISPLAY_NAME = "no3y Code";

/**
 * Upstream's names for the app, and what the fork shows instead. Bare "T3" is
 * matched only inside these phrases: alone it also names T3 Connect, T3 Chat,
 * the T3 server and identifiers, which keep their names.
 */
export const RENAMED_PHRASES = [
  ["T3 Code", FORK_DISPLAY_NAME],
  // The t3_thread_* tool labels; lookups key on the same rewritten text, so they keep matching.
  ["T3 thread", "no3y thread"],
  ["T3 desktop", `${FORK_DISPLAY_NAME} desktop`],
  ["T3 process", `${FORK_DISPLAY_NAME} process`],
  ["T3 system footprint", `${FORK_DISPLAY_NAME} system footprint`],
  ["T3 operations", `${FORK_DISPLAY_NAME} operations`],
  ["T3 could not", `${FORK_DISPLAY_NAME} could not`],
] as const;

/** Phrases that name something other than this app, kept exactly as written. */
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
  "T3 Code · ",
] as const;

/** Modules whose "T3 Code" strings are identities (legacy profile names). */
export const EXCLUDED_MODULES = [/\/apps\/desktop\/src\/app\/DesktopUserData\.ts$/u] as const;

const RENAMES = new Map<string, string>(RENAMED_PHRASES);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const PRESERVED_OR_RENAMED = new RegExp(
  [...PRESERVED_PHRASES, ...RENAMES.keys()].map(escapeRegExp).join("|"),
  "gu",
);

export function rewriteUpstreamDisplayName(code: string): string | null {
  if (!code.includes("T3 ")) {
    return null;
  }
  const rewritten = code.replace(PRESERVED_OR_RENAMED, (match) => RENAMES.get(match) ?? match);
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

export function forkBrandName(): Plugin {
  return {
    name: "fork:brand-name",
    transform(code, id) {
      if (!isRebrandedModule(id)) {
        return null;
      }
      const rewritten = rewriteUpstreamDisplayName(code);
      // Replacements never add or remove lines, so mappings stay line-accurate; columns drift.
      return rewritten === null ? null : { code: rewritten, map: null };
    },
    transformIndexHtml(html) {
      return rewriteUpstreamDisplayName(html) ?? html;
    },
  };
}
