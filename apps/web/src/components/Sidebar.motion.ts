const motionTiming = { duration: 150, easing: "ease-out" };
const rowTravel = (height: number) => Math.min(height, 40);
// Fades clone removed rows and animate clones and entries; intervening layout reads force reflows.
const MAX_FADED_ROWS_PER_UPDATE = 40;

type RowPosition = { top: number; left: number; width: number; height: number };

/* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
/** Fades between two transforms where the row stands instead of riding with its neighbours.
    Only rows `fades` admits fade or count toward the bulk cap; the rest change at once. */
export type SidebarListFadeStyle = {
  readonly shown: string;
  readonly hidden: string;
  readonly fades: (position: RowPosition) => boolean;
  readonly maxFadedRows: number;
};
/* fork:end sidebar-v2-list-animation */

function progress(animation: Animation) {
  return animation.playState === "finished"
    ? 1
    : (animation.effect?.getComputedTiming().progress ?? 0);
}

/** Position the list so all direct children's offsetTop share an origin. */
export function createSidebarListMotion(
  parent: HTMLUListElement,
  /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
  fadeStyle: SidebarListFadeStyle | null = null,
  /* fork:end sidebar-v2-list-animation */
) {
  /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
  const pose = (travel: number, shown: boolean) =>
    fadeStyle === null
      ? `translateY(${shown ? 0 : travel}px)`
      : shown
        ? fadeStyle.shown
        : fadeStyle.hidden;
  const fadeTravel = (travel: number) => (fadeStyle === null ? travel : 0);
  const fades = (position: RowPosition) =>
    position.height > 0 && (fadeStyle === null || fadeStyle.fades(position));
  const maxFadedRows = fadeStyle?.maxFadedRows ?? MAX_FADED_ROWS_PER_UPDATE;
  /* fork:end sidebar-v2-list-animation */
  let positions: Map<HTMLElement, RowPosition> | null = null;
  let disposed = false;
  const reducedMotion = parent.ownerDocument.defaultView?.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const running = new Map<HTMLElement, { animation: Animation; offset: number }>();
  const entering = new Map<HTMLElement, { animation: Animation; travel: number }>();
  const exiting = new Map<HTMLElement, Animation>();
  let released: Map<HTMLElement, number> | null = null;

  const remainingOffset = (node: HTMLElement) => {
    const current = running.get(node);
    const run = current ? current.offset * (1 - progress(current.animation)) : 0;
    const entry = entering.get(node);
    const enter = entry ? entry.travel * (1 - progress(entry.animation)) : 0;
    return run + enter;
  };
  const clearFades = () => {
    for (const entry of entering.values()) entry.animation.cancel();
    for (const animation of exiting.values()) animation.cancel();
    for (const node of exiting.keys()) node.remove();
    entering.clear();
    exiting.clear();
  };
  const fadeOut = (node: HTMLElement, position: RowPosition, travel: number) => {
    /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
    if (!fades(position)) return;
    /* fork:end sidebar-v2-list-animation */
    const clone = node.cloneNode(true) as HTMLElement;
    for (const element of [clone, ...clone.querySelectorAll("*")]) {
      for (const attribute of Array.from(element.attributes)) {
        if (
          (attribute.name === "id" && element.namespaceURI !== "http://www.w3.org/2000/svg") ||
          attribute.name === "data-thread-item" ||
          attribute.name === "data-thread-selection-safe" ||
          attribute.name === "data-testid"
        ) {
          element.removeAttribute(attribute.name);
        }
      }
    }
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    Object.assign(clone.style, {
      position: "absolute",
      top: `${position.top + remainingOffset(node)}px`,
      left: `${position.left}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
      margin: "0",
      boxSizing: "border-box",
      contentVisibility: "visible",
      transform: "none",
      transition: "none",
      pointerEvents: "none",
    });
    parent.append(clone);
    const entry = entering.get(node);
    const entryProgress = entry ? progress(entry.animation) : 1;
    const animation = clone.animate(
      /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
      [
        { opacity: entryProgress, transform: pose(travel, true) },
        { opacity: 0, transform: pose(travel, false) },
      ],
      /* fork:end sidebar-v2-list-animation */
      motionTiming,
    );
    exiting.set(clone, animation);
    animation.addEventListener(
      "finish",
      () => {
        clone.remove();
        exiting.delete(clone);
      },
      { once: true },
    );
  };

  const cancel = (node: HTMLElement) => {
    running.get(node)?.animation.cancel();
    running.delete(node);
  };
  const suspend = () => {
    for (const node of running.keys()) cancel(node);
    clearFades();
    positions = null;
    released = null;
  };
  const move = (node: HTMLElement, offset: number) => {
    cancel(node);
    const entry = entering.get(node);
    if (entry) entry.travel = 0;
    if (offset === 0 && !entry) return;
    const animation = node.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0px)" }],
      motionTiming,
    );
    running.set(node, { animation, offset });
    animation.addEventListener(
      "finish",
      () => {
        if (running.get(node)?.animation === animation) running.delete(node);
      },
      { once: true },
    );
  };

  return {
    update(animate: boolean) {
      if (disposed) return;
      const next = new Map(
        Array.from(parent.children)
          .filter((node): node is HTMLElement => node instanceof HTMLElement && !exiting.has(node))
          .map((node) => [
            node,
            {
              top: node.offsetTop,
              left: node.offsetLeft,
              width: node.offsetWidth,
              height: node.offsetHeight,
            },
          ]),
      );
      let fadeCount = 0;
      if (positions !== null) {
        /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
        for (const [node, position] of positions) {
          if (!next.has(node) && fades(position)) fadeCount++;
        }
        for (const [node, position] of next) {
          if (!positions.has(node) && fades(position)) fadeCount++;
        }
        /* fork:end sidebar-v2-list-animation */
      }
      const shouldAnimate =
        animate &&
        positions !== null &&
        !reducedMotion?.matches &&
        /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
        fadeCount <= maxFadedRows;
      /* fork:end sidebar-v2-list-animation */
      const movedDelta = new Map<HTMLElement, number>();
      const nextOrder = [...next.keys()];
      const oldOrder = positions === null ? [] : [...positions.keys()];
      const ridingDelta = (
        order: readonly HTMLElement[],
        index: number,
        retained: (node: HTMLElement) => boolean,
      ) => {
        for (let cursor = index - 1; cursor >= 0; cursor--) {
          const node = order[cursor]!;
          const delta = movedDelta.get(node);
          if (delta !== undefined) return delta;
          if (retained(node)) return remainingOffset(node);
        }
        return undefined;
      };
      if (!shouldAnimate) clearFades();
      else {
        for (const [node, position] of next) {
          const previousTop = positions!.get(node)?.top;
          if (previousTop === undefined || previousTop === position.top) continue;
          movedDelta.set(node, previousTop + remainingOffset(node) - position.top);
        }
        for (const [node, position] of positions!) {
          if (next.has(node)) continue;
          const delta = ridingDelta(oldOrder, oldOrder.indexOf(node), (n) => next.has(n));
          /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
          fadeOut(
            node,
            position,
            fadeTravel(delta === undefined ? rowTravel(position.height) : -delta),
          );
          /* fork:end sidebar-v2-list-animation */
        }
      }
      for (const [node, entry] of entering) {
        if (!next.has(node)) {
          entry.animation.cancel();
          entering.delete(node);
        }
      }
      for (const node of running.keys()) {
        if (!shouldAnimate || !next.has(node)) cancel(node);
      }
      if (shouldAnimate) {
        for (const [index, node] of nextOrder.entries()) {
          const position = next.get(node)!;
          const previousTop = positions!.get(node)?.top;
          if (previousTop === undefined) {
            /* fork:begin sidebar-v2-list-animation — see .fork/customizations.yaml#sidebar-v2-list-animation */
            if (fades(position)) {
              const delta = ridingDelta(nextOrder, index, (n) => positions!.has(n));
              const travel = fadeTravel(delta === undefined ? -rowTravel(position.height) : delta);
              const animation = node.animate(
                [
                  { opacity: 0, transform: pose(travel, false) },
                  { opacity: 1, transform: pose(travel, true) },
                ],
                motionTiming,
              );
              /* fork:end sidebar-v2-list-animation */
              entering.set(node, { animation, travel });
              animation.addEventListener(
                "finish",
                () => {
                  if (entering.get(node)?.animation === animation) entering.delete(node);
                },
                { once: true },
              );
            }
            continue;
          }
          const delta = movedDelta.get(node);
          // Computed progress includes easing; carry forward only our translation, never dnd-kit's
          // transforms.
          if (delta !== undefined) move(node, delta);
        }
      }
      if (released !== null) {
        if (!reducedMotion?.matches) {
          for (const [node, position] of next) {
            const top = released.get(node);
            if (top !== undefined) move(node, top - position.top);
          }
        }
        released = null;
      }
      positions = next;
    },
    release() {
      suspend();
      const origin = parent.getBoundingClientRect().top;
      released = new Map(
        Array.from(parent.children)
          .filter((node): node is HTMLElement => node instanceof HTMLElement && !exiting.has(node))
          .map((node) => [node, node.getBoundingClientRect().top - origin]),
      );
    },
    suspend,
    dispose() {
      suspend();
      disposed = true;
    },
  };
}
