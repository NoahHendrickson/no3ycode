// Types for the parts of css.mjs the fork guards' cssRules.ts reads.
export interface CssDeclaration {
  readonly property: string;
  readonly value: string;
  readonly line: number;
}

/** `parents`/`atHeaders`: enclosing style rules' and at-rules' headers, outermost first. */
export interface CssBlock {
  readonly kind: "style" | "at";
  readonly name?: string;
  readonly header: string;
  readonly prelude: string;
  readonly line: number;
  readonly endLine: number;
  readonly open: number;
  readonly close: number;
  readonly atRules: ReadonlyArray<string>;
  readonly atHeaders: ReadonlyArray<string>;
  readonly parents: ReadonlyArray<string>;
  readonly selectors?: ReadonlyArray<string>;
  readonly declarations: ReadonlyArray<CssDeclaration>;
  readonly keyframes?: boolean;
  readonly children: number;
}

export declare function readCss(text: string): {
  readonly blocks: ReadonlyArray<CssBlock>;
  readonly comments: ReadonlyArray<{ text: string; line: number; endLine: number }>;
  /** The text between the block's braces, comments blanked. */
  readonly body: (block: CssBlock) => string;
};

export declare function splitTopLevel(text: string, separator: string): string[];
