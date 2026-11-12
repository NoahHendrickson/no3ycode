import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../test/render";
import { attachSidebarV2ListMotion } from "./sidebarV2ListAnimation";

// One identity across renders, as the sidebar's own ref has.
const attach = (node: HTMLUListElement | null) =>
  node ? attachSidebarV2ListMotion(node) : undefined;

function List(props: { readonly rows: readonly string[] }) {
  return (
    <ul data-testid="list" ref={attach}>
      {props.rows.map((row) => (
        <li key={row} data-row={row} style={{ height: 20 }}>
          {row}
        </li>
      ))}
    </ul>
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

describe("attachSidebarV2ListMotion", () => {
  it("grows an added row in and slides the rows it pushes down", async () => {
    await using screen = await render(<List rows={["a", "c"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["a", "b", "c"]} />);
    await vi.waitFor(() =>
      expect(animations.moves()).toEqual([
        ["b", ["scale(.98)", "scale(1)"]],
        ["c", ["translate(0px, -20px)", "translate(0, 0)"]],
      ]),
    );
  });

  it("shrinks a removed row out where it stood, as a stand-in nothing can find", async () => {
    await using screen = await render(<List rows={["a", "b", "c"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["a", "c"]} />);
    await vi.waitFor(() =>
      expect(animations.moves()).toEqual([
        ["b", ["scale(1)", "scale(.98)"]],
        ["c", ["translate(0px, 20px)", "translate(0, 0)"]],
      ]),
    );
    const standIn = animations.spy.mock.contexts[0] as HTMLElement;
    expect(standIn.getAttribute("aria-hidden")).toBe("true");
    expect(standIn.hasAttribute("data-row")).toBe(true);
    expect(standIn.style.top).toBe("20px");
  });

  it("slides reordered rows and leaves a still list alone", async () => {
    await using screen = await render(<List rows={["a", "b"]} />, OPTIONS);
    using animations = recordAnimations();
    await screen.rerender(<List rows={["b", "a"]} />);
    await vi.waitFor(() =>
      expect(animations.moves()).toEqual(
        expect.arrayContaining([
          ["a", ["translate(0px, -20px)", "translate(0, 0)"]],
          ["b", ["translate(0px, 20px)", "translate(0, 0)"]],
        ]),
      ),
    );
    animations.spy.mockClear();
    await screen.rerender(<List rows={["b", "a"]} />);
    expect(animations.moves()).toEqual([]);
  });
});
