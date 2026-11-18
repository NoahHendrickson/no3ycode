import { Controls, Description, Primary, Subtitle, Title } from "@storybook/addon-docs/blocks";

// One live example, rendered inline, plus the props table. Every story rendering in its own
// frame made a docs page boot the app once per story (4–7 s); the rest open from the sidebar.
export function DocsPage() {
  return (
    <>
      <Title />
      <Subtitle />
      <Description />
      <Primary />
      <Controls />
    </>
  );
}
