// @effect-diagnostics nodeBuiltinImport:off
/**
 * Fork guard — see `.fork/README.md` §4b and
 * `.fork/customizations.yaml#fork-sidebar-chrome`.
 *
 * Moving the collapse toggle into the sidebar header creates one way to brick
 * the app: the toggle now unmounts with the panel it collapses. Two things stop
 * that — the floating control still renders while the sidebar is shut, and the
 * keybinding is registered above both. Most of this file is about those two.
 */

import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { cn } from "../lib/utils";
import { cssRules } from "./cssRules";

function readSibling(relativePath: string): string {
  return NodeFS.readFileSync(NodeURL.fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

const layout = readSibling("../components/AppSidebarLayout.tsx");
const chrome = readSibling("../components/sidebar/SidebarChrome.tsx");
const desktopWindow = readSibling("../../../desktop/src/window/DesktopWindow.ts");
const sidebarPrimitive = readSibling("../components/ui/sidebar.tsx");
/** A class const from the primitive's fork-sidebar-chrome hunk, its `${…}` parts inlined. */
function chromeConst(name: string): string {
  const raw = new RegExp("const " + name + '\\s*=\\s*["`]([^"`]+)["`]', "u").exec(
    sidebarPrimitive,
  )?.[1];
  expect(raw, `${name} not found in ui/sidebar.tsx`).toBeTruthy();
  return (raw ?? "").replace(/\$\{(\w+)\}/gu, (_, inner: string) => chromeConst(inner));
}
const themeRules = cssRules(readSibling("../theme.custom.css"));

describe("fork guard: fork-sidebar-chrome", () => {
  it("still offers a toggle while the sidebar is collapsed", () => {
    // The inline toggle leaves with the panel. Without this branch a collapsed
    // sidebar can only be reopened by keyboard or by finding the rail.
    // Upstream now keeps the wrapper mounted and swaps the trigger in place;
    // its showSidebar (false on Welcome) drops the toggle with the sidebar.
    expect(layout).toContain("{showSidebar && !isSidebarVisible ? (");
    expect(layout).toContain("data-sidebar-control");
  });

  it("registers the toggle keybinding above the button that can unmount", () => {
    // Order matters, not just presence: an early return placed before the
    // effect would make the shortcut itself conditional on the sidebar being
    // open — the one state in which you need it most.
    // Formatting may break the comparison across lines; match the token pair.
    const effect = layout.search(/!isSidebarToggleShortcut\(event,/u);
    const earlyReturn = layout.indexOf("{showSidebar && !isSidebarVisible ? (");
    expect(effect).toBeGreaterThanOrEqual(0);
    expect(earlyReturn).toBeGreaterThan(effect);
  });

  it("draws the toggle inside the sidebar header on every viewport", () => {
    // Hiding it above `md` was correct while the desktop toggle floated
    // elsewhere. Left in place it would hide the only toggle an open sidebar
    // has on desktop. Scoped to the element rather than the file so prose about
    // the class cannot satisfy or break the check.
    const start = chrome.indexOf("<SidebarTrigger");
    expect(start).toBeGreaterThanOrEqual(0);
    const trigger = chrome.slice(start, chrome.indexOf("/>", start));
    expect(trigger).not.toContain("md:hidden");
  });

  it("matches the macOS control geometry from the header design", () => {
    expect(chrome).toContain("pl-[var(--workspace-controls-left)]");
    // 85 native points: 17/18 of upstream's zoom-corrected 90, the toggle
    // 10 points past the green light once the lights sit at x=21.
    expect(layout).toContain("MACOS_TRAFFIC_LIGHTS_LEFT_INSET =");
    expect(layout).toContain('"calc(var(--desktop-window-controls-inset, 90px) * 17 / 18)"');
    // x=21 centres the red light on the sidebar's nav icons (centre 28).
    expect(desktopWindow).toContain("const MACOS_WINDOW_BUTTON_X = 21;");
    expect(desktopWindow).toContain("x: MACOS_WINDOW_BUTTON_X,");
    // y=19 centres the 14pt lights at 26pt, the 52px header's axis the
    // toggle, brand, and workspace title share; y=18 sat 1pt high.
    // The fence stays even if the number matches upstream — unfenced, a sync
    // retune lands silently and the value assert only fails after the fact.
    expect(desktopWindow).toContain("fork:begin fork-sidebar-chrome");
    expect(desktopWindow).toContain("fork:end fork-sidebar-chrome");
    // Upstream derives the position from its topbar constants; assert the
    // resolved number so a retune of either constant still turns this red.
    const topbarHeight = Number(/MACOS_WORKSPACE_TOPBAR_HEIGHT = (\d+)/u.exec(desktopWindow)?.[1]);
    const buttonRadius = Number(/MACOS_WINDOW_BUTTON_RADIUS = (\d+)/u.exec(desktopWindow)?.[1]);
    expect(topbarHeight / 2 - buttonRadius).toBe(19);
    expect(desktopWindow).toContain(
      "y: MACOS_WORKSPACE_TOPBAR_HEIGHT / 2 - MACOS_WINDOW_BUTTON_RADIUS",
    );
    const start = chrome.indexOf("<SidebarTrigger");
    const trigger = chrome.slice(start, chrome.indexOf("/>", start));
    expect(trigger).toContain("[&_svg]:size-4!");
    expect(trigger).toContain("[&_svg]:text-sidebar-muted-foreground/80!");
    expect(trigger).not.toContain("text-white");
    expect(layout).toContain('className="pointer-events-auto [&_svg]:size-4!"');
    // One glyph open or shut: an upstream sync restoring the ternary would
    // swap the toggle for a different shape whenever the panel collapses.
    // Scoped to SidebarTrigger itself, so an upstream PanelLeftIcon elsewhere
    // in the module (a rail, a menu) does not trip the guard.
    const triggerStart = sidebarPrimitive.indexOf("function SidebarTrigger(");
    const triggerPrimitive = sidebarPrimitive.slice(
      triggerStart,
      sidebarPrimitive.indexOf("\nfunction ", triggerStart + 1),
    );
    expect(triggerPrimitive).toContain("fork:begin fork-sidebar-chrome");
    expect(triggerPrimitive).toContain("<PanelLeftCloseIcon />");
    expect(triggerPrimitive).not.toContain("<PanelLeftIcon />");
  });

  it("draws the fork's dither on the Dev channel and leaves Nightly alone", () => {
    // Nightly is the control: it is the one label still routed to upstream's
    // own art, so a change that collapsed every channel onto one artwork fails
    // here.
    const backdrop = readSibling("../components/SidebarStageBackdrop.tsx");
    expect(backdrop).toContain("<SidebarStageDitherArt");
    expect(backdrop).toContain("NightlySkyArt");
    expect(backdrop).not.toContain("stage-blueprint");
  });

  it("keeps the sidebar header flat on every build", () => {
    expect(chrome).not.toContain("ForkSidebarHeaderBackdrop");
    expect(chrome).not.toContain("<SidebarStageBackdrop");
    expect(chrome).not.toContain("stage-dither");
  });

  it("leaves the send button and auth screen gated on the build channel", () => {
    // Those two are what still say "this is a Dev build" now that the sidebar
    // no longer does. Both must keep testing the variant rather than rendering
    // unconditionally.
    for (const path of ["../components/chat/ComposerPrimaryActions.tsx"]) {
      const file = readSibling(path);
      expect(file, `${path} stopped gating its stage art`).toMatch(/stage(?:Backdrop)?Variant \?/u);
      expect(file).not.toContain("ForkSidebarHeaderBackdrop");
    }
  });

  it("keeps the supplied Dev artwork on the remaining channel cues", () => {
    // The art is the designer's own PNG. An earlier revision reproduced it as a
    // Bayer dither in SVG, which scaled better but flattened the reference's
    // diagonal ramp — so "it still renders and still looks green" is exactly
    // the failure this asserts against.
    const art = readSibling("../custom/SidebarStageDitherArt.tsx");
    expect(art).toContain('from "./assets/sidebar-stage-dither-dev.png"');
    expect(
      NodeFS.existsSync(
        NodeURL.fileURLToPath(
          new URL("../custom/assets/sidebar-stage-dither-dev.png", import.meta.url),
        ),
      ),
    ).toBe(true);
  });

  it("covers rather than tiles the band", () => {
    // The source ramps diagonally, so any repeat butts a light edge against a
    // dark one and draws a seam at every tile boundary.
    const art = readSibling("../custom/SidebarStageDitherArt.tsx");
    expect(art).toContain("bg-cover");
    expect(art).toContain("bg-no-repeat");
    expect(art).not.toMatch(/className="[^"]*\bstage-dither\b/u);
  });

  it("keeps the search and project rows fork-owned", () => {
    // Pure presentation. Fenced in place it left SidebarV2 carrying the whole
    // rewrite; here the fence is two call sites (actions + projects filter).
    const sidebarV2 = readSibling("../components/Sidebar.tsx");
    expect(sidebarV2).toContain("<SidebarV2ChromeActionRows");
    expect(sidebarV2).toContain("<SidebarV2ProjectScopeRow");
    expect(sidebarV2).toContain("scopedProjectDisplayName=");
    expect(sidebarV2).not.toContain('data-testid="command-palette-trigger"');
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    // Composition / labels / testids — not internal row export names that a
    // helper collapse is free to erase.
    expect(rows).toContain("function ChromeLabeledAction");
    expect(rows).toContain('data-testid="command-palette-trigger"');
    expect(rows).toContain('testId="sidebar-v2-new-thread"');
    expect(rows).toContain('data-testid="sidebar-v2-add-project"');
    expect(rows).toContain('testId="sidebar-v2-usage"');
    expect(rows).toContain('testId="sidebar-v2-pull-requests"');
    expect(rows).toContain('data-testid="sidebar-v2-project-filter"');
    expect(rows).toMatch(/>Search</u);
    expect(rows).toContain('label="New agent"');
    expect(rows).toContain('label="Pull requests"');
    // Add a project is the Threads row's icon button, not a labeled row.
    expect(rows).not.toMatch(/(?<![-\w])label="Add a project"/u);
    expect(rows).toMatch(/<ChromeAutomationsRow \/>\s*<ChromePullRequestsRow \/>/u);
    expect(rows).not.toContain("New thread");
    // The Usage row navigates itself; Sidebar passes it no handler.
    expect(sidebarV2).not.toContain("onUsage=");
    expect(sidebarV2).not.toContain('void router.navigate({ to: "/usage" });');
    // One door, not two: the footer hides its Usage icon and drops upstream's
    // Pull requests icon, since the rows above open the same pages. Upstream
    // always shows the undo notice in its utility menu.
    expect(sidebarV2).toContain("<SidebarChromeFooter hideUsage />");
    expect(chrome).not.toContain('label="Pull requests"');
    expect(chrome).toMatch(
      /hideUsage \? null : \(\s*<SidebarUtilityItem\s+icon=\{<ChartNoAxesColumnIcon/u,
    );
    expect(chrome).toContain("<SidebarUtilityMenu hideUsage={hideUsage} />");
  });

  it("draws the action rows as the design system's ghost button", () => {
    // Figma 364:10544 at its default size: 32px tall, 10px corners, 12px
    // inline padding, a 16px icon 6px from a 14px Regular label, all at the
    // panel's foreground, stacked 2px apart inside the 8px inset and flush
    // under the header.
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    // The box is the row's; the look is SidebarMenuButton's chrome variant.
    expect(rows).toContain('const CHROME_ACTION = "h-auto w-full";');
    expect(rows).toContain('variant="chrome"');
    const action = chromeConst("FORK_CHROME_ROW");
    for (const cls of [
      "py-1.5",
      "gap-1.5",
      // 10px: the sidebar pins --spacing to 4px.
      "rounded-[--spacing(2.5)]",
      "px-3",
      "hover:bg-sidebar-row-hover",
    ]) {
      expect(action).toContain(cls);
    }
    expect(rows).toContain('cn("gap-0.5 px-2 pt-0 pb-0", CHROME_ROW_INSET)');
    const labeledIcon = /<Icon className="([^"]*)"/u.exec(rows)?.[1];
    expect(labeledIcon).toMatch(/\bsize-4\b/u);
    // No shortcut chips: the design draws none, and the shortcut rides the
    // accessible name instead.
    expect(rows).not.toContain("<Kbd");
  });

  it("pays for the thread list's scroll gutter out of its own end padding", () => {
    // scrollbar-gutter:stable reserves the scrollbar inside the list's padding
    // box, so a symmetric px-2 is 8px of air on the left and 8 plus the
    // scrollbar on the right, and every card sits off-centre in its column.
    // The end padding gives that width back, and the gutter has to stay: the
    // compensation is meaningless without the thing it compensates for, so the
    // two only make sense together.
    const sidebarV2 = readSibling("../components/Sidebar.tsx");
    expect(sidebarV2).toContain("[scrollbar-gutter:stable]");
    // One source for the 8. Spelling it once as a variable and reading it from
    // both sides is what stops a retune of the start padding leaving the end
    // subtracting from a stale base — three independent spellings of the same
    // number is how that drifts silently.
    expect(sidebarV2).toContain("[--sidebar-list-pad:--spacing(2)]");
    expect(sidebarV2).toContain("ps-(--sidebar-list-pad)");
    expect(sidebarV2).toContain(
      "pe-[calc(var(--sidebar-list-pad)-var(--sidebar-list-gutter,0px))]",
    );
    // And the width subtracted is measured, not assumed. --app-scrollbar-width
    // is only true where ::-webkit-scrollbar applies; on Firefox the reserved
    // gutter is the native width, or nothing at all under overlay scrollbars,
    // and a token-matching guard cannot see either. Reading the token here
    // again would reintroduce exactly that.
    const gutter = readSibling("../custom/useScrollGutterWidth.ts");
    expect(gutter).toContain("offsetWidth - node.clientWidth");
    expect(sidebarV2).toContain("ref={listScrollGutterRef}");
    // The token-based giveback is this file's own prior implementation —
    // pe-[calc(0.5rem-var(--app-scrollbar-width))], replaced by the measured
    // gutter in 56954bc8 — which makes it the likeliest thing a revert or a
    // wrong-side conflict resolution puts back, including *alongside* the
    // measured term, where the containment checks above stay green and the
    // last pe-* wins. Bounded to a pe-* utility so prose about the token
    // cannot trip it, and looser than the old exact literal so a re-spelling
    // like pe-[calc(var(--sidebar-list-pad)-var(--app-scrollbar-width))]
    // cannot sail past.
    expect(sidebarV2).not.toMatch(/pe-\[[^\]]*--app-scrollbar-width/u);
  });

  it("draws no brand in the header, and keeps the mode tabs on its trailing edge", () => {
    // The pixel flower and the "no3y" wordmark were removed; neither upstream's brand link nor
    // its T3 wordmark comes back in their place.
    expect(chrome).not.toMatch(/SidebarBrand(Mark|Wordmark)?\b(?!WidthProbe)/u);
    expect(chrome).not.toContain("sidebar-brand");
    expect(chrome).not.toContain("T3Wordmark");
    expect(chrome).not.toContain("{APP_BASE_NAME}");
    expect(chrome).toMatch(/className="mr-3 ml-auto flex shrink-0[^"]*">\{modeTabs\}/u);
  });

  it("keeps the flat header independent of identification mode and honors the pill", () => {
    expect(chrome).not.toContain('=== "artwork"');
    expect(chrome).toContain('environmentIdentificationMode === "pill"');
    expect(chrome).toContain('data-environment-identification="pill"');
    const pill = chrome.slice(chrome.indexOf("{pillLabel ? ("), chrome.indexOf("</Badge>"));
    expect(pill).toContain("bg-sidebar-control-surface");
    expect(pill).toContain("text-sidebar-foreground");
    expect(pill).not.toContain("text-white");
  });

  it("keeps the chrome-row icon tint displacing the menu button's base dim", () => {
    // Upstream v0.0.30 gave sidebarMenuButtonVariants a parent-level icon pair
    // (muted-foreground at opacity-60) that outweighs an icon's own class, so
    // the fork rows counter it with a later same-slot pair that twMerge keeps.
    // Asserting the merged outcome rather than the source string is the point:
    // if upstream reshapes the selector ([&_svg], a data-slot rule, an !
    // modifier) so the pair stops conflicting, the dim survives the merge and
    // this reds while every source-string check stays green. The base is read
    // out of the cva call because upstream does not export it, and importing
    // the component just for its class string would drag the whole sidebar
    // module graph into this test.
    const sidebar = readSibling("../components/ui/sidebar.tsx");
    const base = /const sidebarMenuButtonVariants = cva\(\s*"([^"]+)"/u.exec(sidebar)?.[1];
    expect(base, "sidebarMenuButtonVariants base class not found").toBeTruthy();
    const merged = cn(base, chromeConst("FORK_CHROME_ICON_TINT"));
    expect(merged).not.toMatch(/svg\]:opacity-60/u);
    expect(merged).not.toMatch(/svg\]:text-muted-foreground/u);
    expect(merged).toMatch(/svg\]:text-sidebar-foreground/u);
    expect(merged).toMatch(/svg\]:opacity-100/u);
    // One spelling: both chrome-row looks reference the shared const, and
    // the literal exists only in its definition — a second paste is how the
    // two drifted apart before it was hoisted.
    expect(sidebar.split("[&>svg]:opacity-100").length - 1).toBe(1);
    expect(sidebar.split("${FORK_CHROME_ICON_TINT}").length - 1).toBeGreaterThanOrEqual(2);
    for (const look of ["FORK_CHROME_ROW", "FORK_CHROME_ICON"]) {
      expect(cn(base, chromeConst(look))).toMatch(/svg\]:opacity-100/u);
    }
  });

  it("keeps chrome type at Sidebar font size for actions and the Threads label", () => {
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    const type = chromeConst("FORK_CHROME_ROW").replace(/\[&>svg\]:\S+/gu, "");
    expect(type).toContain("text-sidebar-chrome");
    // Label/14 Regular at the panel's foreground. The active twin displaces
    // sidebarMenuButtonVariants' data-[active=true]:font-medium so a held
    // New agent draft does not jump back to Medium.
    expect(type).toContain("font-normal");
    expect(type).toContain("data-[active=true]:font-normal");
    expect(type).not.toContain("font-medium");
    expect(type).toContain("text-sidebar-foreground");
    expect(type).not.toMatch(/\btext-xs\b/u);
    expect(type).not.toMatch(/\btext-sm\b/u);
    // Merged outcome, same reason as the icon tint: the base's active state
    // spells font-medium, and a source-string check on the variant alone
    // stays green if twMerge stops treating those as the same slot.
    const sidebar = readSibling("../components/ui/sidebar.tsx");
    const base = /const sidebarMenuButtonVariants = cva\(\s*"([^"]+)"/u.exec(sidebar)?.[1];
    expect(base, "sidebarMenuButtonVariants base class not found").toBeTruthy();
    const merged = cn(base, type);
    expect(merged).toContain("font-normal");
    expect(merged).toContain("data-[active=true]:font-normal");
    expect(merged).not.toContain("font-medium");
    // The action rows read it (Search, and the labeled rows held or not); the
    // Threads label spells its own, matching the status-section labels under
    // it (12px medium) so the list's headings read as one family.
    expect(rows).toContain('variant="chrome"');
    expect(rows).toContain('variant={active ? "chrome-held" : "chrome"}');
    // Held: the row keeps its hover fill while its target is open.
    expect(sidebar).toContain(
      '"chrome-held": `${FORK_CHROME_ROW} bg-sidebar-row-hover text-sidebar-foreground`',
    );
    // The label is the shared section label (sidebar-v2-threads-fold), which carries that type.
    expect(rows).toMatch(/<SidebarV2SectionLabel[^>]*>\s*Threads/u);
    expect(readSibling("../custom/SidebarV2SectionLabel.tsx")).toContain(
      '"text-sidebar-meta font-medium text-muted-foreground"',
    );
  });

  it("keeps Threads as a static label with sort and an active-aware filter", () => {
    // Figma 368:21211: the label, then two 32px icon buttons on the list edge
    // — sort (ArrowsDownUp) over the client's sidebarProjectSortOrder, and the
    // menu button (a gear) that owns the scope / grouping / density menu.
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    // Named for what the list shows; it was "Projects" until the filter menu
    // grew grouping and density options that are about threads, not projects.
    expect(rows).toMatch(/>\s*Threads\s*</u);
    expect(rows).toContain("<SettingsIcon");
    expect(rows).toContain("ArrowUpDownIcon");
    expect(rows).toContain('data-testid="sidebar-v2-project-sort"');
    expect(rows).toContain("props.onProjectSortOrderChange(value as SidebarProjectSortOrder)");
    for (const order of ["updated_at", "created_at", "manual"]) {
      expect(rows).toContain(`${order}:`);
    }
    const button = /export const PROJECTS_ROW_BUTTON = "([^"]+)"/u.exec(rows)?.[1];
    expect(button).toContain("size-8");
    expect(chromeConst("FORK_CHROME_ICON")).toContain("rounded-[--spacing(2.5)]");
    const sidebarV2 = readSibling("../components/Sidebar.tsx");
    expect(sidebarV2).toContain("snapshotVisibleProjectOrderAsManual(projectGroups)");
    expect(sidebarV2).toContain("updateClientSettings({ sidebarProjectSortOrder: sortOrder })");
    expect(rows).toContain("FolderPlusIcon");
    // Scope on-state: glyph lifts and aria/tooltip name the active project.
    // Glyph only: data-active paints SidebarMenuButton's selected fill, which
    // reads as a hover stuck on.
    expect(rows).toContain('variant={isScoped ? "chrome-icon-lit" : "chrome-icon"}');
    expect(sidebarPrimitive).toContain(
      '"chrome-icon-lit": `${FORK_CHROME_ICON} text-sidebar-foreground`',
    );
    expect(rows).not.toContain("data-active={isScoped");
    expect(rows).toContain("scopedProjectDisplayName");
    expect(rows).toContain("Filter threads by project — showing");
    expect(rows).toContain("TooltipPopup");
    // The label is not a menu trigger — the funnel owns the menu.
    expect(rows).not.toContain("ChevronsUpDownIcon");
    expect(rows).not.toContain("FolderOpenIcon");
  });

  it("scopes to any number of projects from checkbox items", () => {
    // The scope is a set: each project is a checkbox that toggles itself and
    // leaves the others alone, and the menu stays open so choosing three does
    // not take three trips. "All projects" is the empty set — checked while
    // nothing is scoped, clearing the set when chosen.
    const rows = readSibling("../custom/SidebarV2ChromeRows.tsx");
    // Everything under the menu's last separator is the scope list; the
    // grouping radios and the Compact cards checkbox sit above it.
    const scopeMenu = rows.slice(rows.lastIndexOf("<FullWidthMenuSeparator />"));
    expect(scopeMenu).toContain('testId="sidebar-v2-project-scope-all"');
    expect(rows).toContain("readonly projectScopeKeys: ReadonlySet<string>;");
    expect(rows).toContain(
      "readonly onProjectScopeChange: (scopeKeys: ReadonlySet<string>) => void;",
    );
    expect(rows).toContain("checked={!isScoped}");
    expect(rows).toContain(
      "onCheckedChange={() => props.onProjectScopeChange(EMPTY_PROJECT_SCOPE)}",
    );
    expect(rows).toContain("checked={props.projectScopeKeys.has(project.projectKey)}");
    expect(rows).toContain("if (!next.delete(projectKey)) next.add(projectKey);");
    expect(scopeMenu).toContain("<ScopeCheckboxItem");
    expect(scopeMenu).not.toContain("<MenuRadioItem");
    expect(scopeMenu).not.toContain("<MenuCheckboxItem");
    // A real checkbox box, not a bare check glyph: the indicator stays mounted
    // on unchecked rows as an empty bordered square, and fills with the
    // primary colour when checked — the design system's own checkbox
    // treatment (ui/checkbox), so several toggles read as several toggles.
    const item = rows.slice(
      rows.indexOf("function ScopeCheckboxItem"),
      rows.indexOf("export function SidebarV2ProjectScopeRow"),
    );
    expect(item).toContain("<MenuPrimitive.CheckboxItem");
    expect(item).toContain("closeOnClick={false}");
    expect(item).toMatch(/<MenuPrimitive\.CheckboxItemIndicator\s+keepMounted\b/u);
    expect(item).toContain('data-slot="menu-checkbox-item"');
    const box = /const SCOPE_CHECKBOX =\s*"([^"]+)"/u.exec(rows)?.[1];
    expect(box).toBeDefined();
    for (const cls of ["size-4", "rounded-sm", "border"]) {
      expect(box).toContain(cls);
    }
    // The two fills are chosen off the checked prop, not data-checked:
    // variants — the unchecked dark: fill sorts after those in Tailwind's
    // cascade and painted over the checked white.
    expect(rows).toMatch(/const SCOPE_CHECKBOX_ON =\s*"[^"]*\bbg-primary\b/u);
    expect(rows).toMatch(/const SCOPE_CHECKBOX_OFF =\s*"[^"]*\bborder-input\b/u);
    // In dark the box borders on a foreground alpha, not --input: the fork
    // palettes' opaque --input matches the hovered row's 8% foreground wash,
    // and the unchecked box disappeared under the pointer.
    expect(rows).toMatch(/const SCOPE_CHECKBOX_OFF =\s*"[^"]*\bdark:border-foreground\/\d+\b/u);
    expect(rows).not.toMatch(/const SCOPE_CHECKBOX_OFF =\s*"[^"]*\bdark:bg-input\b/u);
    expect(item).toContain("props.checked ? SCOPE_CHECKBOX_ON : SCOPE_CHECKBOX_OFF");
    expect(box).not.toContain("data-checked:");
    // The radio item's [&_svg]:-mx-0.5 pulled Lucide folders (and favicon
    // fallbacks) 2px off the <img> favicons' column; the scope item carries
    // no such rule, and every scope item shares the switch row's start inset.
    const scopeItem = /const SCOPE_ITEM =\s*"([^"]+)"/u.exec(rows)?.[1];
    expect(scopeItem).toBeDefined();
    expect(scopeItem).not.toContain("-mx-0.5");
    expect(scopeItem).not.toMatch(/\bpx-1\b/u);
    expect(scopeItem).toContain("ps-2");
    expect(scopeItem).toContain("pe-1.5");
    // The sidebar filters on the union of every scoped project's member refs,
    // prunes keys whose project has gone, and names the scope as one project
    // or a count.
    const sidebarV2 = readSibling("../components/Sidebar.tsx");
    expect(sidebarV2).toContain("useState<ReadonlySet<string>>(EMPTY_PROJECT_SCOPE)");
    expect(sidebarV2).toContain("scopedProjectGroups.flatMap((group) =>");
    // Upstream's prune also waits for project configs before dropping a key.
    expect(sidebarV2).toMatch(
      /allProjectSnapshotsReady &&\s*allProjectConfigsReady &&\s*scopedProjectGroups\.length !== projectScopeKeys\.size/u,
    );
    expect(sidebarV2).toContain("`${scopedProjectGroups.length} projects`");
    expect(sidebarV2).toContain("scopedProjectDisplayName={scopedProjectsLabel}");
    expect(sidebarV2).toContain("onProjectScopeChange={setProjectScopeKeys}");
  });

  it("holds the footer icons off the bottom edge by the side inset", () => {
    // Upstream's py-1 left Settings / Pull Requests 4px off the window's
    // rounded bottom corner while they stood 8px off its side.
    const footer = themeRules.find(
      (rule) =>
        rule.selector.includes('[data-fork="noahhendrickson-t3code"]') &&
        rule.selector.includes('[data-slot="sidebar-footer"]') &&
        rule.body.includes("padding-bottom"),
    );
    expect(footer?.body).toContain("padding-bottom: var(--sidebar-content-inset)");
    expect(sidebarPrimitive).toContain('data-slot="sidebar-footer"');
  });
});
