/**
 * Native macOS Liquid Glass behind the Flat Glass new-agent composer — see
 * `.fork/customizations.yaml#fork-cool-darker-sidebar-vibrancy`.
 *
 * Mounts the active still new-agent backdrop (`Jolly Petal`, `Mountain Dither`)
 * and `NSGlassEffectView` cards behind Chromium so the composer, launchpad, and
 * open popups refract the backdrop art while DOM text stays sharp on top.
 */
import { type RefObject, useEffect } from "react";

import { observeResize } from "~/lib/observeResize";

import { FORK_GLASS_3D_ATTRIBUTE } from "./forkGlass3d";
import { isForkSidebarLiquidGlassApplied } from "./forkSidebarVibrancy";

const FORK_DRAFT_LIQUID_GLASS_ATTRIBUTE = "data-fork-draft-liquid-glass";
const FORK_DRAFT_GLASS_POPUP_ATTRIBUTE = "data-fork-draft-glass-popup";
const PORTAL_SELECTOR = "[data-base-ui-portal]";

const DRAFT_POPUP_SELECTOR = [
  ':is([data-slot="menu-popup"], [data-slot="menu-sub-content"], [data-slot="popover-popup"]).dropdown-glass',
  '[data-slot="select-popup"] > .dropdown-glass',
  '.dropdown-glass:has(> [data-slot="combobox-popup"])',
].join(", ");

const POPUP_SETTLE_FRAMES = 6;

interface DraftLiquidGlassRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface DraftLiquidGlassCard extends DraftLiquidGlassRect {
  readonly cornerRadius: number;
}

interface DraftLiquidGlassPayload {
  readonly stage: DraftLiquidGlassRect;
  readonly imageKey: string;
  readonly imageBase64?: string;
  readonly image: DraftLiquidGlassRect;
  readonly cards: ReadonlyArray<DraftLiquidGlassCard>;
}

type DraftLiquidGlassSetter = (state: DraftLiquidGlassPayload | null) => Promise<boolean>;

function readDraftLiquidGlassSetter(): DraftLiquidGlassSetter | null {
  const bridge = (globalThis as { forkDesktopBridge?: unknown }).forkDesktopBridge;
  if (typeof bridge !== "object" || bridge === null) return null;
  const lg = (bridge as { sidebarLiquidGlass?: unknown }).sidebarLiquidGlass;
  if (typeof lg !== "object" || lg === null) return null;
  const setter = (lg as { setDraftGlass?: unknown }).setDraftGlass;
  return typeof setter === "function" ? (setter as DraftLiquidGlassSetter) : null;
}

// AppKit holds one draft layer per window. Its hide waits two frames, so the page has painted its
// opaque stage over the layer first: hiding sooner shows the window's black base through the
// still-transparent stage while the thread renders. A draft shown in between cancels it.
let pendingNativeHide: number | null = null;

function cancelPendingNativeHide(): void {
  if (pendingNativeHide === null) return;
  cancelAnimationFrame(pendingNativeHide);
  pendingNativeHide = null;
}

function hideNativeAfterPaint(setter: DraftLiquidGlassSetter): void {
  cancelPendingNativeHide();
  pendingNativeHide = requestAnimationFrame(() => {
    pendingNativeHide = requestAnimationFrame(() => {
      pendingNativeHide = null;
      void setter(null).catch(() => {});
    });
  });
}

const imageBase64Cache = new Map<string, Promise<string | null>>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function loadImageBase64(url: string): Promise<string | null> {
  const existing = imageBase64Cache.get(url);
  if (existing !== undefined) return existing;
  const pending = (async () => {
    try {
      const response = await fetch(url);
      if (response.ok) return arrayBufferToBase64(await response.arrayBuffer());
    } catch {
      // Fall through: a failed fetch must not stick for the session.
    }
    imageBase64Cache.delete(url);
    return null;
  })();
  imageBase64Cache.set(url, pending);
  return pending;
}

function isFlatDraftLiquidGlassEligible(): boolean {
  if (typeof document === "undefined") return false;
  return (
    isForkSidebarLiquidGlassApplied() &&
    document.documentElement.getAttribute(FORK_GLASS_3D_ATTRIBUTE) === "off"
  );
}

function roundRect(rect: DraftLiquidGlassRect): DraftLiquidGlassRect {
  return {
    x: Math.round(rect.x * 2) / 2,
    y: Math.round(rect.y * 2) / 2,
    width: Math.round(rect.width * 2) / 2,
    height: Math.round(rect.height * 2) / 2,
  };
}

/** Native glass sits behind the stage alone, so only a popup wholly inside it can stand on it;
    one reaching over the sidebar keeps the sidebar's solid fill (forkGlassPopupCutout.ts). */
function rectWithin(inner: DraftLiquidGlassRect, outer: DraftLiquidGlassRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function rectsIntersect(a: DraftLiquidGlassRect, b: DraftLiquidGlassRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** The largest corner, since one native card takes a single radius. */
function readCornerRadius(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const parsed = Math.max(
    ...[
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ].map((value) => Number.parseFloat(value) || 0),
  );
  return parsed > 0 ? parsed : 8;
}

function readDraftPopupElements(stageBox: DraftLiquidGlassRect): HTMLElement[] {
  const matched: HTMLElement[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>(DRAFT_POPUP_SELECTOR)) {
    if (el.hasAttribute("data-ending-style") || el.closest("[data-ending-style], [hidden]")) {
      continue;
    }
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    if (!rectWithin(box, stageBox)) continue;
    matched.push(el);
  }
  return matched;
}

function buildCardPopupMask(
  cardBox: DOMRect,
  popups: ReadonlyArray<DraftLiquidGlassCard>,
): string | null {
  const holes: string[] = [];
  for (const p of popups) {
    if (!rectsIntersect(cardBox, p)) continue;
    const x = Math.round((p.x - cardBox.left) * 2) / 2;
    const y = Math.round((p.y - cardBox.top) * 2) / 2;
    // SVG clamps rx and ry separately, so an unclamped pill radius goes elliptical.
    const r = Math.min(p.cornerRadius, p.width / 2, p.height / 2);
    holes.push(
      `<rect x="${x}" y="${y}" width="${p.width}" height="${p.height}" rx="${r}" ry="${r}" fill="black"/>`,
    );
  }
  if (holes.length === 0) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardBox.width}" height="${cardBox.height}" viewBox="0 0 ${cardBox.width} ${cardBox.height}"><defs><mask id="m"><rect width="100%" height="100%" fill="white"/>${holes.join("")}</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function readDraftCardElements(chatView: Element): HTMLElement[] {
  const hero = chatView.querySelector('[data-chat-composer-overlay="true"][data-draft-hero]');
  if (hero === null) return [];
  const selectors = ["[data-fork-composer-vessel]", "[data-fork-draft-launchpad-card]"];
  const elements: HTMLElement[] = [];
  for (const selector of selectors) {
    for (const el of hero.querySelectorAll<HTMLElement>(selector)) {
      elements.push(el);
    }
  }
  return elements;
}

function isClipOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "hidden" || value === "clip";
}

function clipRectToAncestors(
  el: HTMLElement,
  stopAt: Element,
  stageBox: DOMRect,
): DraftLiquidGlassRect | null {
  const box = el.getBoundingClientRect();
  let left = Math.max(box.left, stageBox.left);
  let top = Math.max(box.top, stageBox.top);
  let right = Math.min(box.right, stageBox.right);
  let bottom = Math.min(box.bottom, stageBox.bottom);

  let parent = el.parentElement;
  while (parent !== null && parent !== stopAt) {
    const style = getComputedStyle(parent);
    const clipX = isClipOverflow(style.overflowX);
    const clipY = isClipOverflow(style.overflowY);
    if (clipX || clipY) {
      const parentBox = parent.getBoundingClientRect();
      if (clipX) {
        left = Math.max(left, parentBox.left);
        right = Math.min(right, parentBox.right);
      }
      if (clipY) {
        top = Math.max(top, parentBox.top);
        bottom = Math.min(bottom, parentBox.bottom);
      }
    }
    parent = parent.parentElement;
  }

  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

type DraftBackdropLayoutFor = (
  box: { width: number; height: number },
  dpr: number,
) => { readonly cell: number; readonly left: number; readonly top: number };

interface MeasuredDraftScene {
  readonly stage: DraftLiquidGlassRect;
  readonly image: DraftLiquidGlassRect;
  readonly cardBoxes: ReadonlyArray<{ readonly el: HTMLElement; readonly box: DOMRect }>;
  readonly popups: ReadonlyArray<HTMLElement>;
  readonly popupCards: ReadonlyArray<DraftLiquidGlassCard>;
  readonly cards: ReadonlyArray<DraftLiquidGlassCard>;
}

function measureDraftGlassScene(
  chatView: Element,
  stageEl: HTMLElement,
  layoutFor: DraftBackdropLayoutFor,
  cells: { readonly width: number; readonly height: number },
): MeasuredDraftScene | null {
  const stageBox = stageEl.getBoundingClientRect();
  if (stageBox.width <= 0 || stageBox.height <= 0) return null;

  const cardBoxes: Array<{ readonly el: HTMLElement; readonly box: DOMRect }> = [];
  const cards: DraftLiquidGlassCard[] = [];
  for (const el of readDraftCardElements(chatView)) {
    const clipped = clipRectToAncestors(el, chatView, stageBox);
    if (clipped === null) continue;
    cardBoxes.push({ el, box: el.getBoundingClientRect() });
    cards.push({
      ...roundRect(clipped),
      cornerRadius: readCornerRadius(el),
    });
  }
  if (cards.length === 0) return null;

  const popups = readDraftPopupElements(stageBox);
  const popupCards: DraftLiquidGlassCard[] = [];
  for (const popup of popups) {
    const card: DraftLiquidGlassCard = {
      ...roundRect(popup.getBoundingClientRect()),
      cornerRadius: readCornerRadius(popup),
    };
    popupCards.push(card);
    cards.push(card);
  }

  const { cell, left, top } = layoutFor(
    { width: stageBox.width, height: stageBox.height },
    window.devicePixelRatio || 1,
  );
  return {
    stage: roundRect(stageBox),
    image: roundRect({
      x: left,
      y: top,
      width: cells.width * cell,
      height: cells.height * cell,
    }),
    cardBoxes,
    popups,
    popupCards,
    cards,
  };
}

function applyDraftPopupCutouts(
  scene: Pick<MeasuredDraftScene, "cardBoxes" | "popups" | "popupCards">,
  stampedPopups: Set<HTMLElement>,
  maskedCards: Map<HTMLElement, string>,
): Set<HTMLElement> {
  const nextStamped = new Set<HTMLElement>(scene.popups);
  for (const prev of stampedPopups) {
    if (!nextStamped.has(prev)) prev.removeAttribute(FORK_DRAFT_GLASS_POPUP_ATTRIBUTE);
  }
  for (const popup of scene.popups) {
    if (!stampedPopups.has(popup)) {
      popup.setAttribute(FORK_DRAFT_GLASS_POPUP_ATTRIBUTE, "true");
    }
  }

  const nextMasked = new Set<HTMLElement>();
  for (const { el, box } of scene.cardBoxes) {
    const nextMask = buildCardPopupMask(box, scene.popupCards);
    if (nextMask === null) continue;
    nextMasked.add(el);
    if (maskedCards.get(el) !== nextMask) {
      el.style.maskImage = nextMask;
      el.style.webkitMaskImage = nextMask;
      maskedCards.set(el, nextMask);
    }
  }
  for (const prev of maskedCards.keys()) {
    if (!nextMasked.has(prev)) {
      prev.style.maskImage = "";
      prev.style.webkitMaskImage = "";
      maskedCards.delete(prev);
    }
  }
  return nextStamped;
}

export function useForkDraftLiquidGlass(input: {
  readonly ref: RefObject<HTMLDivElement | null>;
  readonly url: string;
  readonly cells: { readonly width: number; readonly height: number };
  readonly layoutFor: DraftBackdropLayoutFor;
}): void {
  const { ref, url, cells, layoutFor } = input;
  const cellsWidth = cells.width;
  const cellsHeight = cells.height;

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- syncs draft DOM geometry and popups with the native macOS Liquid Glass layer
  useEffect(() => {
    const setter = readDraftLiquidGlassSetter();
    const stageEl = ref.current;
    if (setter === null || stageEl === null) return;
    // Split mode can show two draft panes at once, while AppKit holds one draft
    // backdrop layer per window; keep the CSS blur fallback in split panes.
    if (stageEl.closest("[data-fork-split-pane]") !== null) return;

    const chatView = stageEl.closest("[data-chat-column-maximized-away]") ?? stageEl.parentElement;
    if (chatView === null) return;

    let disposed = false;
    let observersAttached = false;
    let rafId: number | null = null;
    let settleRemaining = 0;
    let lastSentKey = "";
    // Set once a payload is sent and kept through failures: a refused update leaves the
    // previous native layer mounted, so only an explicit hide may clear it.
    let nativeShown = false;
    let uploadedImageKey: string | null = null;
    let retrying = false;
    let observedCards: HTMLElement[] = [];
    let stopObservedResize: (() => void) | null = null;
    let chatObserver: MutationObserver | null = null;
    let bodyChildObserver: MutationObserver | null = null;
    const portalObservers = new Map<Element, MutationObserver>();
    let stampedPopups = new Set<HTMLElement>();
    const maskedCards = new Map<HTMLElement, string>();

    const clearCardMasks = () => {
      for (const el of maskedCards.keys()) {
        el.style.maskImage = "";
        el.style.webkitMaskImage = "";
      }
      maskedCards.clear();
    };

    const clearStampedPopups = () => {
      for (const popup of stampedPopups) {
        popup.removeAttribute(FORK_DRAFT_GLASS_POPUP_ATTRIBUTE);
      }
      stampedPopups = new Set();
      clearCardMasks();
    };

    const clearNative = () => {
      clearStampedPopups();
      document.documentElement.removeAttribute(FORK_DRAFT_LIQUID_GLASS_ATTRIBUTE);
      lastSentKey = "";
      uploadedImageKey = null;
      retrying = false;
      if (nativeShown) {
        nativeShown = false;
        hideNativeAfterPaint(setter);
      }
    };

    const scheduleSync = (settleFrames = 0) => {
      if (disposed) return;
      if (settleFrames > settleRemaining) settleRemaining = settleFrames;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(sync);
    };

    const onWindowResize = () => scheduleSync();
    const onScroll = () => scheduleSync();

    const handleApplyFailure = () => {
      uploadedImageKey = null;
      lastSentKey = "";
      clearStampedPopups();
      document.documentElement.removeAttribute(FORK_DRAFT_LIQUID_GLASS_ATTRIBUTE);
      if (!retrying) {
        retrying = true;
        scheduleSync();
      }
    };

    const refreshObservedTargets = () => {
      const nextCards = readDraftCardElements(chatView);
      const same =
        nextCards.length === observedCards.length &&
        nextCards.every((el, idx) => el === observedCards[idx]);
      if (same && stopObservedResize !== null) return;
      stopObservedResize?.();
      observedCards = nextCards;
      stopObservedResize = observeResize([stageEl, chatView, ...observedCards], () =>
        scheduleSync(),
      );
    };

    // Tooltips and every other app popup portal here too; only a draft popup, or
    // one already cut out, moves the glass.
    const portalHoldsDraftPopup = (portal: Element) =>
      stampedPopups.size > 0 || portal.querySelector(DRAFT_POPUP_SELECTOR) !== null;

    const syncPortalObservers = () => {
      const portals = new Set(document.body.querySelectorAll(PORTAL_SELECTOR));
      for (const [portal, observer] of portalObservers) {
        if (!portals.has(portal)) {
          observer.disconnect();
          portalObservers.delete(portal);
        }
      }
      for (const portal of portals) {
        if (portalObservers.has(portal)) continue;
        const observer = new MutationObserver(() => {
          if (portalHoldsDraftPopup(portal)) scheduleSync(POPUP_SETTLE_FRAMES);
        });
        observer.observe(portal, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            "style",
            "hidden",
            "data-ending-style",
            "data-starting-style",
            "data-open",
          ],
        });
        portalObservers.set(portal, observer);
      }
    };

    const attachActiveObservers = () => {
      if (observersAttached) return;
      observersAttached = true;
      refreshObservedTargets();
      chatObserver = new MutationObserver((records) => {
        let relevant = false;
        let cardSetChanged = false;
        for (const record of records) {
          const target =
            record.target instanceof Element ? record.target : record.target.parentElement;
          if (target === null) continue;
          // Typing edits the prompt editor; the vessel's ResizeObserver already
          // catches the growth that matters, so keystrokes never measure here.
          if (target.closest('[contenteditable="true"]') !== null) continue;
          // The popup cutout masks this hook writes onto the cards.
          if (record.attributeName === "style" && maskedCards.has(target as HTMLElement)) {
            continue;
          }
          relevant = true;
          if (record.attributeName !== "style" && record.attributeName !== "class") {
            cardSetChanged = true;
          }
        }
        if (!relevant) return;
        if (cardSetChanged) refreshObservedTargets();
        scheduleSync();
      });
      chatObserver.observe(chatView, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-draft-hero", "hidden", "style", "class", "data-ending-style"],
      });
      // Watch only direct children of body so Base UI portals mounting/unmounting
      // trigger sync without observing sidebar or transcript mutations.
      syncPortalObservers();
      bodyChildObserver = new MutationObserver(() => {
        syncPortalObservers();
        // A removed portal can take a cut-out popup with it.
        if (stampedPopups.size > 0) {
          scheduleSync(POPUP_SETTLE_FRAMES);
          return;
        }
        for (const portal of portalObservers.keys()) {
          if (!portalHoldsDraftPopup(portal)) continue;
          scheduleSync(POPUP_SETTLE_FRAMES);
          return;
        }
      });
      bodyChildObserver.observe(document.body, { childList: true });
      chatView.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onWindowResize);
    };

    const detachActiveObservers = () => {
      if (!observersAttached) return;
      observersAttached = false;
      stopObservedResize?.();
      stopObservedResize = null;
      observedCards = [];
      chatObserver?.disconnect();
      chatObserver = null;
      bodyChildObserver?.disconnect();
      bodyChildObserver = null;
      for (const observer of portalObservers.values()) observer.disconnect();
      portalObservers.clear();
      chatView.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onWindowResize);
    };

    const sync = () => {
      rafId = null;
      if (disposed) return;
      if (!isFlatDraftLiquidGlassEligible()) {
        detachActiveObservers();
        clearNative();
        return;
      }
      attachActiveObservers();

      const scene = measureDraftGlassScene(chatView, stageEl, layoutFor, {
        width: cellsWidth,
        height: cellsHeight,
      });
      if (scene === null) {
        clearNative();
        return;
      }

      stampedPopups = applyDraftPopupCutouts(scene, stampedPopups, maskedCards);

      const key = JSON.stringify({
        url,
        // Main scales CSS px by the zoom factor, so a zoom change must re-send.
        dpr: window.devicePixelRatio,
        stage: scene.stage,
        image: scene.image,
        cards: scene.cards,
      });
      if (key !== lastSentKey) {
        lastSentKey = key;

        const needsImage = uploadedImageKey !== url;
        const send = (imageBase64: string | undefined) => {
          if (disposed || key !== lastSentKey) return;
          nativeShown = true;
          cancelPendingNativeHide();
          void setter({
            stage: scene.stage,
            imageKey: url,
            ...(imageBase64 !== undefined ? { imageBase64 } : {}),
            image: scene.image,
            cards: scene.cards,
          })
            .then((applied) => {
              if (disposed || key !== lastSentKey) return;
              if (applied) {
                uploadedImageKey = url;
                retrying = false;
                document.documentElement.setAttribute(FORK_DRAFT_LIQUID_GLASS_ATTRIBUTE, "true");
              } else {
                handleApplyFailure();
              }
            })
            .catch(() => {
              if (disposed || key !== lastSentKey) return;
              handleApplyFailure();
            });
        };

        if (needsImage) {
          void loadImageBase64(url).then((base64) => {
            if (disposed || key !== lastSentKey || base64 === null) return;
            send(base64);
          });
        } else {
          send(undefined);
        }
      }

      if (settleRemaining > 0) {
        settleRemaining -= 1;
        rafId = requestAnimationFrame(sync);
      }
    };

    const rootObserver = new MutationObserver(() => scheduleSync());
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-fork-theme", "data-fork-sidebar-vibrancy", FORK_GLASS_3D_ATTRIBUTE],
    });

    sync();

    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      detachActiveObservers();
      rootObserver.disconnect();
      clearNative();
    };
  }, [ref, url, cellsWidth, cellsHeight, layoutFor]);
}
