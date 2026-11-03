import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { fakeTimers, render } from "../../test/render";
import { useSidebarPeekState, useSidebarPeekTrigger } from "./sidebarPeek";

function Harness({ enabled = true, menuOpen = false }: { enabled?: boolean; menuOpen?: boolean }) {
  const peek = useSidebarPeekState();
  const triggerProps = useSidebarPeekTrigger({ enabled, pathname: "/" });
  return (
    <div data-testid="root" data-peek={peek} style={{ display: "grid", gap: 40, width: 300 }}>
      {/* Collapsing swaps the header toggle for the floating one in the same spot. */}
      {enabled ? (
        <button key="floating" type="button" {...triggerProps}>
          floating toggle
        </button>
      ) : (
        <button key="header" type="button">
          header toggle
        </button>
      )}
      <div data-app-sidebar="" data-slot="sidebar-container">
        <button type="button" aria-haspopup="menu" data-popup-open={menuOpen ? "" : undefined}>
          menu trigger
        </button>
        <button type="button" data-popup-open="">
          tooltip trigger
        </button>
      </div>
      <div>portaled menu</div>
      <div>workspace</div>
    </div>
  );
}

const TIMERS: Parameters<typeof fakeTimers>[0] = { toFake: ["setTimeout", "clearTimeout"] };

describe("useSidebarPeekTrigger", () => {
  it("does not peek a toggle that mounted under the pointer until the pointer leaves it", async () => {
    await using screen = await render(<Harness enabled={false} />);
    await userEvent.hover(screen.getByText("header toggle"));
    using _timers = fakeTimers(TIMERS);
    await screen.rerender(<Harness />);
    const toggle = screen.getByText("floating toggle");
    await userEvent.hover(toggle, { position: { x: 4, y: 4 } });
    vi.advanceTimersByTime(500);
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "off");

    await userEvent.hover(screen.getByText("workspace"));
    await userEvent.hover(toggle);
    vi.advanceTimersByTime(80);
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "open");
  });

  it("dismisses once the card's menu closes under a still pointer", async () => {
    await using screen = await render(<Harness />);
    using _timers = fakeTimers(TIMERS);
    await userEvent.hover(screen.getByText("workspace"));
    await userEvent.hover(screen.getByText("floating toggle"));
    vi.advanceTimersByTime(80);
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "open");

    await screen.rerender(<Harness menuOpen />);
    await userEvent.hover(screen.getByText("portaled menu"));
    vi.advanceTimersByTime(1000);
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "open");

    await screen.rerender(<Harness />);
    vi.advanceTimersByTime(200);
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "dismissed");
  });

  it("leaves Escape to an open card menu, but not to a tooltip", async () => {
    await using screen = await render(<Harness menuOpen />);
    using _timers = fakeTimers(TIMERS);
    await userEvent.hover(screen.getByText("workspace"));
    await userEvent.hover(screen.getByText("floating toggle"));
    vi.advanceTimersByTime(80);
    await userEvent.hover(screen.getByText("tooltip trigger"));
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "open");

    await screen.rerender(<Harness />);
    await userEvent.keyboard("{Escape}");
    await expect.element(screen.getByTestId("root")).toHaveAttribute("data-peek", "dismissed");
  });
});
