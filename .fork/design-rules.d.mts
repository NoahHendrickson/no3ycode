// Types for design-rules.mjs, which the root vite.config.ts imports and the
// app typechecks include.
export declare const DESIGN_LINT_BLOCKING: boolean;
export declare const DESIGN_LINT_ENV: string;
export declare const DESIGN_LINT_TSX_SCOPE: string[];
export declare const DESIGN_LINT_CUSTOM_ONLY_SCOPE: string[];
export declare const DESIGN_ARBITRARY_VALUE_ALLOW: string[];
export declare const DESIGN_OXLINT_RULE_IDS: Record<string, string>;
export declare const DESIGN_LINT_OVERRIDES: Array<{
  files: string[];
  excludeFiles?: string[];
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}>;
