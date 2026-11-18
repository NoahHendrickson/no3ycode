// @effect-diagnostics nodeBuiltinImport:off
/** Fork guard — see `.fork/customizations.yaml#fork-tabs`. */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { IconTab, Tab, Tabs } from "../custom/Tabs";

function read(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

describe("fork-tabs", () => {
  it("stamps the markers Basic's tabs rule keys on", () => {
    const html = renderToStaticMarkup(
      createElement(
        Tabs,
        { "aria-label": "Mode", value: ["code"] },
        createElement(IconTab, { value: "code", "aria-label": "Code" }),
        createElement(Tab, { value: "chat" }, "Chat"),
      ),
    );
    expect(html).toContain("data-fork-tabs");
    expect(html).toContain('data-fork-tab="icon"');
    expect(html).toContain('data-fork-tab="word"');
    expect(html).toContain('data-fork-tabs-size="sm"');
  });

  it("sizes icon tabs from the track under Basic", () => {
    const basic = read("../theme.custom.basic.css");
    expect(basic).toMatch(
      /&\[data-fork-tabs-size="md"\] > \[data-fork-tab="icon"\] \{\s*width: 28px;\s*height: 28px;/u,
    );
    expect(basic).toMatch(
      /&\[data-fork-tabs-size="lg"\] > \[data-fork-tab="icon"\] \{\s*width: 32px;\s*height: 32px;/u,
    );
  });

  it("builds the sidebar's Code / Chat switch from it", () => {
    const switcher = read("../custom/SidebarModeTabs.tsx");
    expect(switcher).toContain('from "./Tabs"');
    expect(switcher).toMatch(/<Tabs\b/u);
    expect(switcher).toMatch(/<IconTab\b/u);
  });

  it("draws the Figma tabs under Basic and keeps the page rule off them", () => {
    const basic = read("../theme.custom.basic.css");
    expect(basic).toMatch(
      /\[data-fork-theme="basic"\] \[data-fork-tabs\] \{\s*height: auto;\s*padding: 2px;\s*border-radius: 8px;\s*background-color: var\(--basic-wash-2\);/u,
    );
    expect(basic).toContain(
      "[data-fork-segmented-tabs]:not([data-fork-thread-tabs] *, [data-fork-tabs])",
    );
  });
});
