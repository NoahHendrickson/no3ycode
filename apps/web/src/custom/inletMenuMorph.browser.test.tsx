import { describe, expect, it } from "vite-plus/test";

import { render } from "../../test/render";
import { setActiveForkPalette } from "./forkActivePalette";
import { useInletMorphPresence } from "./inletMenuMorph";

function Card({ open, threadKey }: { open: boolean; threadKey: string }) {
  const presence = useInletMorphPresence(open, 60_000, threadKey);
  return <div data-testid="card" data-mounted={presence.mounted ? "yes" : "no"} />;
}

describe("useInletMorphPresence", () => {
  it("lingers through a close, but not into another thread's closed card", async () => {
    setActiveForkPalette("inlet");
    using _palette = { [Symbol.dispose]: () => setActiveForkPalette(null) };
    await using screen = await render(<Card open threadKey="a" />);
    const card = screen.getByTestId("card");

    await screen.rerender(<Card open={false} threadKey="a" />);
    await expect.element(card).toHaveAttribute("data-mounted", "yes");

    await screen.rerender(<Card open threadKey="a" />);
    await screen.rerender(<Card open={false} threadKey="b" />);
    await expect.element(card).toHaveAttribute("data-mounted", "no");
  });
});
