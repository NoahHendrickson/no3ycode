import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { BASIC_APPEARANCES, BASIC_OPTIONS, type BasicAppearance } from "~/custom/forkTheme";
import indexCss from "~/index.css?raw";

import { storyBasicAppearance, storyThemeKey } from "../storyTheme.ts";
import { type ResolvedColor, readTokenColor } from "./resolveColor.ts";
import { sweepTones, type ToneTable } from "./toneSweep.ts";

// Every colour Tailwind exposes to components (`@theme inline` in index.css), read from the CSS
// itself so a token added upstream shows up here without a story edit.
const REGISTERED = [
  ...indexCss.matchAll(/^\s*--color-([a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/gm),
].map(([, name, variable]) => ({ name: name!, variable: variable! }));

const GROUPS: ReadonlyArray<{ title: string; match: (name: string) => boolean }> = [
  {
    title: "Base",
    match: (name) =>
      /^(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|secondary-label|muted|muted-foreground|accent|accent-foreground|border|input|ring|placeholder|icon-muted|code)$/.test(
        name,
      ),
  },
  { title: "Message", match: (name) => name.startsWith("message") },
  {
    title: "Semantic",
    match: (name) => /^(destructive|success|warning|error|info|update|guest|tool-error)/.test(name),
  },
  { title: "Diff", match: (name) => name.startsWith("diff-") },
  { title: "Sidebar", match: (name) => name.startsWith("sidebar") && !name.includes("status") },
  { title: "Thread status", match: (name) => name.includes("status") },
];

// Basic's own ramp (theme.custom.basic.css): the base, ink laid over it, and the text inks.
const BASIC_RAMP = [
  "--basic-base",
  "--basic-lift-1",
  "--basic-lift-2",
  "--basic-lift-3",
  "--basic-lift-4",
  "--basic-raised-quiet",
  "--basic-raised",
  "--basic-wash-1",
  "--basic-wash-2",
  "--basic-wash-3",
  "--basic-wash-4",
  "--basic-text-strong",
  "--basic-text",
  "--basic-text-chrome",
  "--basic-text-muted",
  "--basic-composer-vessel",
  "--basic-composer-prompt",
  "--fork-context-chip-bg",
  "--fork-context-chip-bg-hover",
  "--fork-outline-border",
] as const;

type Swatch = { readonly name: string; readonly variable: string } & ResolvedColor;

function useSwatches(variables: ReadonlyArray<{ name: string; variable: string }>) {
  const scope = useRef<HTMLDivElement>(null);
  const [swatches, setSwatches] = useState<ReadonlyArray<Swatch>>([]);
  useLayoutEffect(() => {
    const element = scope.current;
    if (!element) return;
    setSwatches(
      variables.map((entry) => ({ ...entry, ...readTokenColor(element, entry.variable) })),
    );
  }, [variables]);
  return { scope, swatches };
}

function SwatchRow({ swatch }: { swatch: Swatch }) {
  return (
    <div
      className="flex items-center gap-3"
      data-token={swatch.name}
      data-token-variable={swatch.variable}
      data-token-hex={swatch.hex}
      data-token-alpha={swatch.alpha}
    >
      <span
        className="size-9 shrink-0 rounded-md border border-border"
        style={{ background: `var(${swatch.variable})` }}
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-foreground">{swatch.name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {swatch.hex}
          {swatch.alpha < 1 ? ` · ${Math.round(swatch.alpha * 100)}%` : ""}
        </span>
      </span>
    </div>
  );
}

// `@theme inline` emits no --color-* properties at runtime, so each swatch reads the property its
// registration points at. A theme change re-renders the story in place, so the swatch
// stories key on the theme: each one mounts afresh and reads its own values.
const TOKEN_ENTRIES = REGISTERED;
const RAMP_ENTRIES = BASIC_RAMP.map((variable) => ({ name: variable.slice(2), variable }));

function TokenGroups({ sidebar }: { sidebar: boolean }) {
  const { scope, swatches } = useSwatches(TOKEN_ENTRIES);
  return (
    <div
      ref={scope}
      {...(sidebar ? { "data-app-sidebar": "", "data-sidebar-version": "v2" } : {})}
      className="flex flex-col gap-10 bg-background p-2 text-foreground"
    >
      {GROUPS.map((group) => {
        const members = swatches.filter((swatch) => group.match(swatch.name));
        if (members.length === 0) return null;
        return (
          <section key={group.title} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-4">
              {members.map((swatch) => (
                <SwatchRow key={swatch.name} swatch={swatch} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Ramp() {
  const { scope, swatches } = useSwatches(RAMP_ENTRIES);
  return (
    <div
      ref={scope}
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-4"
    >
      {swatches.map((swatch) => (
        <SwatchRow key={swatch.name} swatch={swatch} />
      ))}
    </div>
  );
}

const TABLE_VARIABLES = [
  ...BASIC_RAMP,
  "--foreground",
  "--muted-foreground",
  "--primary",
  "--popover",
  "--card",
  "--border",
  "--input",
  "--message-surface",
  "--destructive",
] as const;

// A translucent token is drawn over its own tone's base, as it would sit in the app.
function paint(color: ResolvedColor, base: ResolvedColor | undefined): string {
  if (color.alpha >= 1 || !base) return color.hex;
  return `linear-gradient(color-mix(in srgb, ${color.hex} ${color.alpha * 100}%, transparent), color-mix(in srgb, ${color.hex} ${color.alpha * 100}%, transparent)), ${base.hex}`;
}

function ToneTableView({ appearance }: { appearance: BasicAppearance }) {
  const table: ToneTable = useMemo(() => sweepTones(TABLE_VARIABLES, appearance), [appearance]);
  return (
    <table className="border-separate border-spacing-1 text-left">
      <thead>
        <tr>
          <th />
          {BASIC_APPEARANCES.map((name) => (
            <th
              key={name}
              className="w-20 px-1 pb-2 align-bottom text-[11px] font-medium text-foreground"
            >
              {BASIC_OPTIONS[name].label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {TABLE_VARIABLES.map((variable) => (
          <tr key={variable}>
            <th className="pr-3 font-mono text-[11px] font-normal whitespace-nowrap text-muted-foreground">
              {variable.slice(2)}
            </th>
            {BASIC_APPEARANCES.map((name) => {
              const values = table.get(name);
              const color = values?.get(variable);
              if (!values || !color) return <td key={name} />;
              return (
                <td
                  key={name}
                  data-tone={name}
                  data-token-variable={variable}
                  data-token-hex={color.hex}
                  data-token-alpha={color.alpha}
                  className="h-7 rounded-md border border-border"
                  style={{ background: paint(color, values.get("--basic-base")) }}
                />
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The ramp and the tone table are Basic's own scale; Glass and Inlet have none. */
function BasicOnly() {
  return (
    <p className="text-sm text-muted-foreground">
      Basic only: pick Basic in the toolbar's Theme menu.
    </p>
  );
}

const meta = {
  title: "Foundations/Colors",
  parameters: { surface: "bare" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every token components paint with, resolved for the theme in the toolbar. */
export const Tokens: Story = {
  render: (_args, { globals }) => <TokenGroups key={storyThemeKey(globals)} sidebar={false} />,
};

/** The sidebar restates part of the family on its own element, so its values can differ. */
export const SidebarScope: Story = {
  name: "Tokens in the sidebar",
  render: (_args, { globals }) => <TokenGroups key={storyThemeKey(globals)} sidebar />,
};

/** Basic is one base colour plus ink laid over it at 4 / 8 / 12 / 16%. */
export const BasicRamp: Story = {
  name: "Basic ramp",
  render: (_args, { globals }) => {
    const appearance = storyBasicAppearance(globals);
    return appearance === null ? <BasicOnly /> : <Ramp key={appearance} />;
  },
};

/** Every tone side by side, read from the CSS by sweeping the root through each tone. */
export const AllTones: Story = {
  name: "All tones",
  render: (_args, { globals }) => {
    const appearance = storyBasicAppearance(globals);
    return appearance === null ? <BasicOnly /> : <ToneTableView appearance={appearance} />;
  },
};
