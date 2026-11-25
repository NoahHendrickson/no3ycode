// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/customizations.yaml#fork-composer-command-card`. A sync that renames the
 * menu's drawer or layer attributes, or the drawer-inset variable, quietly brings back upstream's
 * inset frosted popover.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const flat = (selector: string) =>
  selector.replace(/\s+/gu, " ").replace(/\( /gu, "(").replace(/ \)/gu, ")");
const rules = cssRules(readSibling("../theme.custom.css"));
const threadRules = cssRules(readSibling("../theme.custom.thread-composer.css"));
const menu = readSibling("../components/chat/ComposerCommandMenu.tsx");
const layer = readSibling("../components/chat/ComposerCommandMenuLayer.tsx");

const NOT_INLET = ':root[data-fork="noahhendrickson-t3code"]:not([data-fork-theme="inlet"])';
const DRAWER = "[data-composer-drawer-layer] [data-composer-command-drawer]";

const drawerRule = (suffix = "") =>
  rules.find((rule) => flat(rule.selector) === `${NOT_INLET} ${DRAWER}${suffix}`);

describe("fork guard: fork-composer-command-card", () => {
  it("spans the composer and sits 8px above it", () => {
    const inset = rules.find(
      (rule) => flat(rule.selector) === `${NOT_INLET} [data-chat-composer-form]`,
    );
    expect(inset?.body).toMatch(/--chat-composer-drawer-inset:\s*0rem/u);
    const drawer = drawerRule();
    expect(drawer?.body).toMatch(/--chat-composer-attachment-overlap:\s*0px/u);
    expect(drawer?.body).toMatch(/margin-bottom:\s*calc\(1rem \+ 1px \+ 8px\)/u);
    expect(drawer?.body).toMatch(/border-radius:\s*var\(--fork-composer-radius\)/u);
  });

  it("lets only the card take the pointer, not the lift above the prompt", () => {
    const layerRule = rules.find(
      (rule) => flat(rule.selector) === `${NOT_INLET} [data-composer-drawer-layer]`,
    );
    expect(layerRule?.body).toMatch(/pointer-events:\s*none/u);
    expect(drawerRule()?.body).toMatch(/pointer-events:\s*auto/u);
  });

  it("paints the banner cards' fill and hairline", () => {
    const card = drawerRule("::before");
    expect(card?.body).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--fork-composer-border\)/u);
    expect(card?.body).toMatch(/mask-image:\s*none/u);
    const fill = rules.find(
      (rule) =>
        flat(rule.selector) === `${NOT_INLET}:not([data-fork-draft-hero-shown]) ${DRAWER}::before`,
    );
    expect(fill?.body).toMatch(/background:\s*var\(--fork-composer-bg/u);
    expect(fill?.body).toMatch(/(?<!-)backdrop-filter:\s*none/u);
  });

  it("takes the thread composer's card fill and 12px corners under Flat Glass and Basic", () => {
    const thread =
      ':root[data-fork="noahhendrickson-t3code"]:is([data-fork-glass-3d="off"].dark[data-fork-theme="cool-darker"], [data-fork-theme="basic"]):not([data-fork-draft-hero-shown])';
    const rule = (suffix: string) =>
      threadRules.find((candidate) => flat(candidate.selector) === `${thread} ${DRAWER}${suffix}`);
    expect(rule("")?.body).toMatch(/--fork-composer-radius:\s*12px/u);
    expect(rule("::before")?.body).toMatch(/background:\s*var\(--fork-thread-composer-card\)/u);
  });

  it("runs 40px rows edge to edge between full-width hairlines", () => {
    const row = drawerRule(' [data-slot="command-item"][data-composer-item-id]');
    expect(row?.body).toMatch(/min-height:\s*40px/u);
    expect(row?.body).toMatch(/border-radius:\s*0/u);
    const rule = drawerRule(
      ' [data-slot="command-item"][data-composer-item-id] + [data-slot="command-item"]',
    );
    expect(rule?.body).toMatch(/border-top:\s*1px solid var\(--fork-composer-border\)/u);
    expect(drawerRule(' [data-slot="command-list"]')?.body).toMatch(/padding:\s*0/u);
  });

  it("targets the attributes and variables upstream's menu still uses", () => {
    expect(menu).toContain('data-composer-command-drawer="true"');
    expect(menu).toContain("data-composer-item-id={props.item.id}");
    expect(menu).toContain("<ComposerBanner.Surface");
    expect(layer).toContain('data-composer-drawer-layer="true"');
    expect(layer).toContain('getPropertyValue("--chat-composer-drawer-inset")');
    expect(layer).toContain("const composerOverlap = rootFontSizePx + 1;");
  });
});
