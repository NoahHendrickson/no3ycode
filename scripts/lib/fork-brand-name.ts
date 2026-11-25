/**
 * Fork display-name rewrite — see `.fork/customizations.yaml#fork-brand-name`.
 *
 * Upstream writes "T3 Code" inline in hundreds of strings and adds more every
 * sync. Rewriting them at build time keeps every one of those files untouched,
 * so the brand stays consistent without a conflict surface the size of the app.
 */

import type { Plugin } from "vite-plus";

import { isRebrandedModule, rewriteUpstreamDisplayName } from "./fork-brand-name-core.ts";

export {
  EXCLUDED_MODULES,
  FORK_DISPLAY_NAME,
  PRESERVED_PHRASES,
  isRebrandedModule,
  rewriteUpstreamDisplayName,
} from "./fork-brand-name-core.ts";

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
