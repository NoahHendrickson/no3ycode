import type { Meta, StoryObj } from "@storybook/react-vite";

import { EnvironmentId, ThreadId } from "@t3tools/contracts";

import {
  DesignChangeChip,
  ForkComposerDesignChanges,
} from "~/custom/designMode/ForkComposerDesignChanges";
import { ForkTranscriptDesignChanges } from "~/custom/designMode/ForkTranscriptDesignChanges";
import { useDesignChangeDraftStore } from "~/custom/designMode/designChangeDraftStore";
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

const threadRef = { environmentId: EnvironmentId.make("story"), threadId: ThreadId.make("design") };

/** The composer's row of pending changes, one chip per change, each removable. */
export const Pending: Story = {
  parameters: { controls: { disable: true } },
  beforeEach: () => {
    const store = useDesignChangeDraftStore.getState();
    store.clear(threadRef);
    for (const [tab, entry] of [
      ["tab-a", ONE],
      [
        "tab-b",
        change("e", [{ tag: "nav", sourceLabel: "Nav.tsx:3", deltas: ["gap 8px → 16px"] }]),
      ],
    ] as const) {
      store.add(threadRef, tab, {
        ...entry,
        documentId: tab,
        pageUrl: `http://localhost:3000/${tab}`,
      });
    }
  },
  render: () => <ForkComposerDesignChanges target={threadRef} />,
};

const block = (elements: ReadonlyArray<string>) =>
  [
    "<design_change_request>",
    ...elements.map((label, index) => `## ${index + 1}. ${label}\n\n- padding-top 24px → 32px`),
    "</design_change_request>",
  ].join("\n");

/** A sent message's change requests in the transcript: one element names it, several count. */
export const Sent: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ForkTranscriptDesignChanges
      messageId="story-message"
      blocks={[
        block(["<button> — src/Hero.tsx:42:5"]),
        block(["<h1> — src/Hero.tsx:12:3", "<p> — src/Hero.tsx:18:3"]),
      ]}
    />
  ),
};
