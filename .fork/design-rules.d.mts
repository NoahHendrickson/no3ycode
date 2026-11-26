// Types for design-rules.mjs, which the root vite.config.ts imports and the
// app typechecks include.
export declare const DESIGN_LINT_TSX_SCOPE: string[];
export declare const DESIGN_LINT_CUSTOM_ONLY_SCOPE: string[];
export declare const DESIGN_ARBITRARY_VALUE_ALLOW: string[];
export declare const DESIGN_LINT_PENDING: Record<string, string[]>;
export declare const DESIGN_LINT_OVERRIDES: Array<{
  files: string[];
  excludeFiles?: string[];
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}>;
export declare const DESIGN_LINT_ALLOWLIST: Array<{
  rule: string;
  file?: string;
  match?: string;
  name?: string;
  reason: string;
}>;
export declare const RUNTIME_TOKEN_PREFIXES: string[];
