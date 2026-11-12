import { useLayoutEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../test/render";
import { createSidebarV2ListMotion } from "./sidebarV2ListAnimation";

type Motion = ReturnType<typeof createSidebarV2ListMotion>;

/** The sidebar's wiring: the ref creates the motion, and every commit updates it. */
function List(props: {
  readonly rows: readonly string[];
  /** Rows of a scroll viewport this tall, as the sidebar's list is. */
  readonly viewportHeight?: number;
  readonly onMotion?: (motion: Motion) => void;
}) {
  const motionRef = useRef<Motion | null>(null);
  const [attach] = useState(() => (node: HTMLUListElement) => {
    const motion = createSidebarV2ListMotion(node);
    motionRef.current = motion;
    motion.update(false);
    props.onMotion?.(motion);
    return () => motion.dispose();
  });
  useLayoutEffect(() => {
    motionRef.current?.update(true);
  });
  return (
    <div
      data-slot="scroll-area-viewport"
      style={{ height: props.viewportHeight ?? 400, overflow: "auto" }}
    >
      <ul ref={attach} style={{ position: "relative" }}>
        {props.rows.map((row) => (
          <li key={row} data-row={row} style={{ height: 20 }}>
            {row}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The router only adds a wrapper here; this list is plain DOM.
const OPTIONS = { router: false } as const;

/** What each animated element's keyframes move, by its text: recorded, so a finished
    animation cannot slip past an assertion. */
function recordAnimations() {
  const spy = vi.spyOn(Element.prototype, "animate");
  return {
    spy,
    moves: () =>
      spy.mock.contexts.map((element, index) => [
        (element as Element).textContent,
        (spy.mock.calls[index]![0] as Keyframe[]).map((frame) => frame.transform),
      ]),
    [Symbol.dispose]: () => spy.mockRestore(),
  };
}

const rows = (count: number) => Array.from({ length: count }, (_, index) => String(index));

describe("createSidebarV2ListMotion", () => {
  it("grows an added row in and slides the rows it pushes down", async () => {
    await using screen = await render(<List rows={["a", "c"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["a", "b", "c"]} />);
    expect(animations.moves()).toEqual([
      ["b", ["scale(.98)", "scale(1)"]],
      ["c", ["translateY(-20px)", "translateY(0px)"]],
    ]);
  });

  it("shrinks a removed row out where it stood, as a stand-in nothing can find", async () => {
    await using screen = await render(<List rows={["a", "b", "c"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["a", "c"]} />);
    expect(animations.moves()).toEqual([
      ["b", ["scale(1)", "scale(.98)"]],
      ["c", ["translateY(20px)", "translateY(0px)"]],
    ]);
    const standIn = animations.spy.mock.contexts[0] as HTMLElement;
    expect(standIn.getAttribute("aria-hidden")).toBe("true");
    expect(standIn.style.top).toBe("20px");
  });

  it("slides reordered rows and leaves a still list alone", async () => {
    await using screen = await render(<List rows={["a", "b"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["b", "a"]} />);
    expect(animations.moves()).toEqual(
      expect.arrayContaining([
        ["a", ["translateY(-20px)", "translateY(0px)"]],
        ["b", ["translateY(20px)", "translateY(0px)"]],
      ]),
    );
    animations.spy.mockClear();
    await screen.rerender(<List rows={["b", "a"]} />);
    expect(animations.moves()).toEqual([]);
  });

  it("fades only the rows on screen, however many leave", async () => {
    // A 60px viewport shows rows 0 to 2 of 60; collapsing all but row 0 fades the two in view.
    await using screen = await render(<List rows={rows(60)} viewportHeight={60} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["0"]} viewportHeight={60} />);
    expect(animations.moves()).toEqual([
      ["1", ["scale(1)", "scale(.98)"]],
      ["2", ["scale(1)", "scale(.98)"]],
    ]);
  });

  it("slides a dropped row from where the drag left it", async () => {
    let motion: Motion | null = null;
    const list = (order: readonly string[]) => (
      <List rows={order} onMotion={(attached) => (motion = attached)} />
    );
    await using screen = await render(list(["a", "b"]), OPTIONS);
    const dragged = screen.container.querySelector<HTMLElement>('[data-row="b"]')!;
    // dnd-kit holds the dragged row with a transform until the drop.
    dragged.style.transform = "translateY(-10px)";
    motion!.release();
    dragged.style.transform = "";
    using animations = recordAnimations();
    await screen.rerender(list(["a", "b"]));
    expect(animations.moves()).toEqual([["b", ["translateY(-10px)", "translateY(0px)"]]]);
  });
});
