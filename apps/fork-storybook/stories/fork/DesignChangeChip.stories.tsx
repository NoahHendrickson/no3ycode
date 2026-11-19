import type { Meta, StoryObj } from "@storybook/react-vite";

import { DesignChangeChip } from "~/custom/designMode/ForkComposerDesignChanges";
import type { PendingDesignChange } from "~/custom/designMode/designChangeDraftStore";

import { Row, Stack } from "../Specimen.tsx";

const change = (id: string, elements: PendingDesignChange["elements"]): PendingDesignChange => ({
  id,
  runtimeTabId: "tab",
  documentId: "document",
  pageUrl: "http://localhost:3000/",
  elementCount: elements.length,
  elements,
  markdown: `## Design change\n\n${elements.map((element) => `- ${element.tag}: ${element.deltas.join(", ")}`).join("\n")}`,
});

const ONE = change("a", [
  {
    tag: "button",
    sourceLabel: "Hero.tsx:42",
    deltas: ["padding-top 24px → 32px", "radius 8px → 12px"],
  },
]);

const meta = {
  title: "Fork/Design change chip",
  component: DesignChangeChip,
  tags: ["autodocs"],
  args: { entry: ONE, onRemove: () => {} },
} satisfies Meta<typeof DesignChangeChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A design-mode change waiting in the composer: the element, its source, and the edit in short,
    with the full change request on hover and an ✕ to drop it. */
export const Playground: Story = {};

/** One element, several, and elements design mode could not trace to a source. */
export const Shapes: Story = {
  render: (args) => (
    <Stack gap={3}>
      <Row label="One element">
        <DesignChangeChip {...args} entry={ONE} />
      </Row>
      <Row label="Several">
        <DesignChangeChip
          {...args}
          entry={change("b", [
            { tag: "h1", sourceLabel: "Hero.tsx:12", deltas: ["font-size 32px → 40px"] },
            { tag: "p", sourceLabel: "Hero.tsx:18", deltas: ["color #666 → #444"] },
          ])}
        />
      </Row>
      <Row label="No source">
        <DesignChangeChip
          {...args}
          entry={change("d", [{ tag: "div", sourceLabel: null, deltas: ["gap 8px → 12px"] }])}
        />
      </Row>
      <Row label="Some without source">
        <DesignChangeChip
          {...args}
          entry={change("c", [
            { tag: "div", sourceLabel: null, deltas: ["gap 8px → 12px"] },
            { tag: "span", sourceLabel: "Card.tsx:7", deltas: ["opacity 1 → 0.8"] },
          ])}
        />
      </Row>
    </Stack>
  ),
};
