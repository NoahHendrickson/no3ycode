/** Inlet's one-shape menus: a hung menu, its button and the tab between them drawn as one
    morphing path, so the button's fill and the menu cannot fall out of step. Installed once; a 1ms
    detect animation (theme.custom.inlet-menus.css, Inlet and motion-allowed only) announces each popup. */
import { useEffect, useState } from "react";

import { observeResize } from "~/lib/observeResize";

import { isInletActive } from "./forkActivePalette";

const SVG_NS = "http://www.w3.org/2000/svg";
const DETECT_ANIMATION = "fork-inlet-morph-detect";
// The concave corner where the tab meets the menu (theme.custom.inlet.css --fork-inlet-fillet).
const FILLET = 9;
const OPEN_MS = 300;
const CLOSE_MS = 280;
// A closing card stays mounted until its shape is home, plus two frames.
const CLOSED_MS = CLOSE_MS + 32;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const segment = (value: number, from: number, to: number) =>
  clamp((value - from) / (to - from), 0, 1);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

// Running morphs, dropped to their stylesheet look when the palette or colour changes under one
// (the docked details card stays mounted across a switch made in Settings).
const activeMorphs = new Set<() => void>();

export function installInletMenuMorph() {
  document.addEventListener("animationstart", (event) => {
    if (event.animationName !== DETECT_ANIMATION) return;
    const popup = event.target;
    // A popup can be reused across opens, so each open (data-open) wakes this again. One the
    // morph gave up on stays released: the detect rule matches it again, and retrying would loop.
    if (!(popup instanceof HTMLElement)) return;
    if (popup.dataset.forkMorph === "on" || popup.dataset.forkMorph === "failed") return;
    try {
      startMorph(popup);
    } catch (error) {
      // Never leave a menu hidden: release it to its stylesheet look.
      release(popup);
      throw error;
    }
  });
  new MutationObserver((records) => {
    const root = document.documentElement;
    if (records.every((record) => record.oldValue === root.getAttribute(record.attributeName!))) {
      return;
    }
    for (const abandon of activeMorphs) abandon();
  }).observe(document.documentElement, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-fork-theme", "data-fork-inlet-color"],
  });
}

/** The open button whose `aria-controls` names the popup or something in it (a menu's or
    select's list, a combobox's listbox), as Base UI and the anchored tab menu link them. The
    docked details card is no popup: its button is the pressed details toggle (stamped in
    PanelLayoutControls), nearest its own column first. */
function findTrigger(popup: HTMLElement) {
  if (popup.dataset.threadDetailsPanel === "inline") {
    const toggle = '[data-fork-details-toggle][aria-pressed="true"]';
    return (
      popup.closest("[data-chat-column-maximized-away]")?.querySelector<HTMLElement>(toggle) ??
      document.querySelector<HTMLElement>(toggle)
    );
  }
  for (const candidate of document.querySelectorAll<HTMLElement>(
    '[aria-expanded="true"][aria-controls]',
  )) {
    const controlled = document.getElementById(candidate.getAttribute("aria-controls") ?? "");
    if (controlled && (controlled === popup || popup.contains(controlled))) return candidate;
  }
  return null;
}

/** The box that paints the menu: the popup itself, a select's inner glass, a combobox's outer
    one, or the thread details card a popover wraps. */
function glassOf(popup: HTMLElement) {
  if (popup.matches(".dropdown-glass")) return popup;
  const inner = popup.querySelector<HTMLElement>(
    ":scope > .dropdown-glass, :scope [data-thread-details-card].dropdown-glass",
  );
  if (inner) return inner;
  const outer = popup.parentElement;
  return outer?.matches(".dropdown-glass") ? outer : popup;
}

// What the face needs to look as the button does out of its own context: box, text and paint.
// The clone keeps its classes, so only what its ancestors' selectors gave it has to be restated.
const FACE_PROPERTIES = [
  "display",
  "box-sizing",
  "width",
  "height",
  "min-width",
  "min-height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "justify-content",
  "gap",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "overflow",
  "color",
  "opacity",
  "visibility",
  "background-color",
  "background-image",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant-numeric",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-overflow",
  "text-transform",
  "white-space",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "transform",
  "translate",
  "scale",
  "mask-image",
] as const;

/** The trigger again, on the layer above the shape, styled as it computes now (its open ink). */
function cloneWithStyles(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;
  const sources = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const clones = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  sources.forEach((from, index) => {
    const to = clones[index];
    if (!to) return;
    const computed = getComputedStyle(from);
    for (const property of FACE_PROPERTIES) {
      to.style.setProperty(property, computed.getPropertyValue(property));
    }
    to.removeAttribute("id");
  });
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  clone.style.position = "fixed";
  clone.style.margin = "0";
  clone.style.right = "auto";
  clone.style.bottom = "auto";
  clone.style.translate = "none";
  clone.style.transform = "none";
  clone.style.transition = "none";
  clone.style.animation = "none";
  clone.style.background = "transparent";
  clone.style.boxShadow = "none";
  clone.style.outline = "none";
  return clone;
}

/** The outline at progress `p` (0 = the button alone, 1 = button, tab and menu), for a menu below
    its button. Width leads, height follows; the menu's sides come in to the button's and its foot
    rises to the button's. */
function shapePath(button: Rect, menu: Rect, p: number, buttonRadius: number, menuRadius: number) {
  const width = easeInOutCubic(segment(p, 0.12, 0.72));
  const height = easeInOutCubic(segment(p, 0.08, 1));
  const left = Math.min(button.left, button.left + (menu.left - button.left) * width);
  const right = Math.max(button.right, button.right + (menu.right - button.right) * width);
  const bottom = button.bottom + (menu.bottom - button.bottom) * height;
  const menuTop = Math.min(menu.top, bottom);
  const menuHeight = bottom - menuTop;
  const roomLeft = button.left - left;
  const roomRight = right - button.right;
  const hasMenu = menuHeight > 0.5;
  const r = Math.min(buttonRadius, (button.bottom - button.top) / 2);
  const footRadius = hasMenu
    ? Math.min(menuRadius, menuHeight / 2, (right - left) / 2)
    : Math.min(r, (bottom - button.top) / 2);
  const fillet = (room: number) =>
    Math.max(0, Math.min(FILLET, room / 2, menuTop - button.top - r));
  const corner = (room: number, f: number) =>
    Math.max(0, Math.min(menuRadius, room - f, menuHeight / 2));

  let d = `M${button.left + r} ${button.top}H${button.right - r}`;
  d += `A${r} ${r} 0 0 1 ${button.right} ${button.top + r}`;
  if (hasMenu && roomRight > 0.5) {
    const f = fillet(roomRight);
    const c = corner(roomRight, f);
    d += `V${menuTop - f}A${f} ${f} 0 0 0 ${button.right + f} ${menuTop}`;
    d += `H${right - c}A${c} ${c} 0 0 1 ${right} ${menuTop + c}`;
  }
  d += `V${bottom - footRadius}A${footRadius} ${footRadius} 0 0 1 ${right - footRadius} ${bottom}`;
  d += `H${left + footRadius}A${footRadius} ${footRadius} 0 0 1 ${left} ${bottom - footRadius}`;
  if (hasMenu && roomLeft > 0.5) {
    const f = fillet(roomLeft);
    const c = corner(roomLeft, f);
    d += `V${menuTop + c}A${c} ${c} 0 0 1 ${left + c} ${menuTop}`;
    d += `H${button.left - f}A${f} ${f} 0 0 0 ${button.left} ${menuTop - f}`;
  }
  d += `V${button.top + r}A${r} ${r} 0 0 1 ${button.left + r} ${button.top}Z`;
  return d;
}

const flipped = (rect: Rect): Rect => ({
  left: rect.left,
  right: rect.right,
  top: -rect.bottom,
  bottom: -rect.top,
});

/** Gives a popup back to its stylesheet look: "failed" is never hidden, unlike an unclaimed
    or closed one, so a menu the morph cannot take still shows. */
function release(popup: HTMLElement) {
  const glass = glassOf(popup);
  popup.dataset.forkMorph = "failed";
  glass.dataset.forkMorph = "failed";
  glass.style.opacity = "";
}

function startMorph(popup: HTMLElement) {
  const trigger = findTrigger(popup);
  if (trigger === null) {
    release(popup);
    return;
  }
  // Typed for teardown, a hoisted function the null check does not narrow into.
  const owner: HTMLElement = trigger;
  const glass = glassOf(popup);
  // Read before the morph clears them: a colour can restate the menu's fill (Jungle Art's green,
  // the model menu's shell), and the composer's controls pad their open fill out past the button.
  const glassStyle = getComputedStyle(glass);
  const fill = glassStyle.backgroundColor;
  const menuRadius = Number.parseFloat(glassStyle.borderBottomLeftRadius) || 8;
  const pad =
    Number.parseFloat(getComputedStyle(popup).getPropertyValue("--fork-inlet-tab-pad")) || 0;
  const triggerStyle = getComputedStyle(trigger);

  popup.dataset.forkMorph = "on";
  glass.dataset.forkMorph = "on";
  glass.style.opacity = "0";
  trigger.dataset.forkMorphing = "";

  // One step under the popup's own positioner, above everything it floats over: menus sit at
  // z-130, the thread details popover on the sheet layer (--z-sheet, 46). The docked details card
  // is no portal but a z-20 element in the page, so its layer goes beside it, in its stacking.
  const docked = popup.dataset.threadDetailsPanel === "inline";
  const positioner = docked
    ? popup
    : (popup.closest<HTMLElement>('[data-slot$="-positioner"]') ?? popup.parentElement);
  const popupZ = Number.parseInt(positioner ? getComputedStyle(positioner).zIndex : "", 10);
  const layer = document.createElement("div");
  layer.dataset.forkMorphLayer = "";
  layer.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:${
    Number.isFinite(popupZ) ? popupZ - 1 : 129
  };`;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 10px 18px rgb(0 0 0 / 30%));";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("fill", fill);
  svg.append(path);
  const face = cloneWithStyles(trigger);
  layer.append(svg, face);
  if (docked) popup.before(layer);
  else document.body.append(layer);

  let progress = 0;
  let from = 0;
  let target = 1;
  let startedAt = 0;
  let duration = 0;
  let frame = 0;
  let hold: Animation | null = null;
  let below: boolean | null = null;

  const draw = () => {
    // A scroll or resize can queue a frame that lands after teardown.
    if (tornDown) return;
    // A trigger React remounted reads a zero rect; drawing from it would start at the origin.
    if (!popup.isConnected || !trigger.isConnected) {
      teardown();
      return;
    }
    const triggerBox = trigger.getBoundingClientRect();
    const button: Rect = {
      left: triggerBox.left - pad,
      right: triggerBox.right + pad,
      top: triggerBox.top - pad,
      bottom: triggerBox.bottom + pad,
    };
    const menu = glass.getBoundingClientRect();
    if (menu.width === 0) return;
    // Settled on the first measured frame: a menu that overlaps its button is left as it is.
    if (below === null) {
      below = menu.top >= button.bottom - 1 ? true : menu.bottom <= button.top + 1 ? false : null;
      if (below === null) {
        teardown();
        release(popup);
        return;
      }
      // Above its button (the composer's menus) the shadow would fall on the button's row.
      if (!below) svg.style.filter = "none";
    }
    const buttonRadius =
      Number.parseFloat(
        below ? triggerStyle.borderTopLeftRadius : triggerStyle.borderBottomLeftRadius,
      ) + pad || 8;
    path.setAttribute(
      "d",
      below
        ? shapePath(button, menu, progress, buttonRadius, menuRadius)
        : shapePath(flipped(button), flipped(menu), progress, buttonRadius, menuRadius),
    );
    path.setAttribute("transform", below ? "" : "scale(1 -1)");
    const shown = String(segment(progress, 0, 0.22));
    svg.style.opacity = shown;
    face.style.opacity = shown;
    face.style.left = `${triggerBox.left}px`;
    face.style.top = `${triggerBox.top}px`;
    glass.style.opacity = String(segment(progress, 0.62, 1));
  };

  const tick = (now: number) => {
    const t = duration > 0 ? clamp((now - startedAt) / duration, 0, 1) : 1;
    const eased = target > from ? easeOutCubic(t) : easeInOutSine(t);
    progress = from + (target - from) * eased;
    draw();
    if (t < 1) frame = requestAnimationFrame(tick);
    else if (target === 0) teardown();
  };

  const run = (next: number) => {
    from = progress;
    target = next;
    startedAt = performance.now();
    duration = (next > from ? OPEN_MS : CLOSE_MS) * Math.abs(next - from);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  };

  // Base UI unmounts a closing popup once its own animations finish; this one runs as long as the
  // shape takes to close and changes nothing visible, so the content stays until the shape is home.
  const closing = new MutationObserver(() => {
    const ending = popup.hasAttribute("data-ending-style");
    if (ending && target !== 0) {
      run(0);
      hold?.cancel();
      hold = popup.animate([{ outlineColor: "transparent" }, { outlineColor: "transparent" }], {
        duration: duration + 32,
      });
    } else if (!ending && target === 0) {
      hold?.cancel();
      hold = null;
      run(1);
    }
  });
  closing.observe(popup, { attributes: true, attributeFilter: ["data-ending-style"] });
  // Base UI repositions the menu a frame after a scroll or resize; redraw once it has.
  const redraw = () => requestAnimationFrame(draw);
  // Base UI keeps a popup on its button itself (its anchor tracking); the shape follows wherever it
  // is placed: the positioner's style for a popup, the docked card's own (its top) for the card.
  const placed = docked ? popup : positioner;
  const placement = new MutationObserver(redraw);
  if (placed) placement.observe(placed, { attributes: true, attributeFilter: ["style"] });
  // A placement can also move by transition (the docked card rising for the find bar): follow it
  // frame by frame while any position transition runs on the placed box, the glass or the card.
  const moving = new Set<string>();
  let followFrame = 0;
  const followMove = () => {
    draw();
    followFrame = moving.size > 0 && !tornDown ? requestAnimationFrame(followMove) : 0;
  };
  const isPlacement = (event: TransitionEvent) =>
    ["top", "left", "translate", "transform"].includes(event.propertyName) &&
    (event.target === placed ||
      event.target === glass ||
      (event.target instanceof Element && event.target.parentElement === popup));
  const onMoveStart = (event: TransitionEvent) => {
    if (!isPlacement(event)) return;
    moving.add(event.propertyName);
    if (followFrame === 0) followFrame = requestAnimationFrame(followMove);
  };
  const onMoveEnd = (event: TransitionEvent) => {
    if (isPlacement(event)) moving.delete(event.propertyName);
  };
  const moveTarget = placed ?? popup;
  moveTarget.addEventListener("transitionrun", onMoveStart);
  moveTarget.addEventListener("transitionend", onMoveEnd);
  moveTarget.addEventListener("transitioncancel", onMoveEnd);
  // A popup can also leave without closing (its page changes); the shape goes with it. Its portal
  // is one of the body's children; the docked card is one of its column's, and its layer, the
  // card's sibling, leaves with them. The column's size is what moves the card's toggle.
  const removal = new MutationObserver(() => {
    if (!popup.isConnected) teardown();
  });
  const column = docked ? popup.parentElement : null;
  removal.observe(column ?? document.body, { childList: true });
  const stopResize = observeResize(glass, redraw);
  const stopColumnResize = column ? observeResize(column, redraw) : () => {};
  window.addEventListener("scroll", redraw, true);
  window.addEventListener("resize", redraw);

  let tornDown = false;
  const abandon = () => {
    teardown();
    release(popup);
  };
  activeMorphs.add(abandon);
  function teardown() {
    if (tornDown) return;
    tornDown = true;
    activeMorphs.delete(abandon);
    cancelAnimationFrame(frame);
    cancelAnimationFrame(followFrame);
    closing.disconnect();
    placement.disconnect();
    removal.disconnect();
    moveTarget.removeEventListener("transitionrun", onMoveStart);
    moveTarget.removeEventListener("transitionend", onMoveEnd);
    moveTarget.removeEventListener("transitioncancel", onMoveEnd);
    stopResize();
    stopColumnResize();
    window.removeEventListener("scroll", redraw, true);
    window.removeEventListener("resize", redraw);
    layer.remove();
    delete owner.dataset.forkMorphing;
    // "off": closed. The stylesheet hides it again on its next open, until it is claimed.
    popup.dataset.forkMorph = "off";
    if (glass !== popup) glass.dataset.forkMorph = "off";
    // Closed: the popup lingers a frame or two before Base UI unmounts it, so it stays unseen.
    glass.style.opacity = target === 0 ? "0" : "";
  }

  draw();
  run(1);
}

const morphRuns = () => isInletActive() && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Keeps something Inlet animates closed (the docked details card's shape, the dictation
    timeline) mounted for `ms` after it closes, as Base UI keeps a closing popup: `ending` while
    it folds, then gone. Off Inlet or under reduced motion it unmounts at once, as before. A new
    `key` (the details card's thread) is a different thing, not a close: it never lingers. */
export function useInletMorphPresence(open: boolean, ms = CLOSED_MS, key?: string) {
  const [lingering, setLingering] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const [wasKey, setWasKey] = useState(key);
  if (key !== wasKey) {
    setWasKey(key);
    setWasOpen(open);
    setLingering(false);
  } else if (open !== wasOpen) {
    setWasOpen(open);
    setLingering(!open && morphRuns());
  }
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a timer: it unmounts once its closing animation has run
  useEffect(() => {
    if (!lingering) return;
    const timer = window.setTimeout(() => setLingering(false), ms);
    return () => window.clearTimeout(timer);
  }, [lingering, ms]);
  return { mounted: open || lingering, ending: !open && lingering };
}
