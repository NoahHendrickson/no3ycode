import type { Meta, StoryObj } from "@storybook/react-vite";
import { RunId } from "@t3tools/contracts";
import { type ComponentProps, useState } from "react";

import { ChangedFilesCard } from "~/components/chat/ChangedFilesTree";
import { useRenderedAppearance } from "~/hooks/useTheme";

type CardProps = ComponentProps<typeof ChangedFilesCard>;

const FILES: CardProps["files"] = [
  {
    path: "apps/web/src/custom/ForkSubagentGroup.tsx",
    kind: "modified",
    additions: 42,
    deletions: 18,
  },
  {
    path: "apps/web/src/custom/forkSubagentTree.ts",
    kind: "modified",
    additions: 12,
    deletions: 3,
  },
  { path: "apps/web/src/theme.custom.basic.css", kind: "modified", additions: 9, deletions: 0 },
  {
    path: "apps/web/src/__fork_guards__/forkSubagentSpawnCard.test.ts",
    kind: "added",
    additions: 58,
    deletions: 0,
  },
  { path: ".fork/customizations.yaml", kind: "modified", additions: 6, deletions: 4 },
];

const totalsOf = (files: CardProps["files"]) => ({
  count: files.length,
  additions: files.reduce((sum, file) => sum + file.additions, 0),
  deletions: files.reduce((sum, file) => sum + file.deletions, 0),
});

const runId = RunId.make("run-story");
const noop = () => {};

function Card({ files, totals }: { files: CardProps["files"]; totals?: CardProps["totals"] }) {
  const [expanded, setExpanded] = useState(true);
  const resolvedTheme = useRenderedAppearance();
  return (
    <ChangedFilesCard
      runId={runId}
      files={files}
      totals={totals ?? totalsOf(files)}
      allDirectoriesExpanded={expanded}
      resolvedTheme={resolvedTheme}
      onToggleAllDirectories={() => setExpanded(!expanded)}
      onOpenTurnDiff={noop}
    />
  );
}

const meta = {
  title: "Fork/Changed files card",
  component: ChangedFilesCard,
  tags: ["autodocs"],
  args: {
    runId,
    files: FILES,
    totals: totalsOf(FILES),
    allDirectoriesExpanded: true,
    resolvedTheme: "dark",
    onToggleAllDirectories: noop,
    onOpenTurnDiff: noop,
  },
  decorators: [(Story) => <div className="w-[736px] min-w-0">{Story()}</div>],
} satisfies Meta<typeof ChangedFilesCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The card at the end of a turn: the files as a tree, with the folder and diff actions. */
export const Default: Story = {
  render: (args) => <Card files={args.files} totals={args.totals} />,
};

export const OneFile: Story = {
  name: "One file",
  render: () => <Card files={FILES.slice(2, 3)} />,
};

/** A turn that changed more files than the card lists says how many more there are. */
export const MoreThanShown: Story = {
  name: "More than shown",
  render: () => <Card files={FILES} totals={{ count: 23, additions: 412, deletions: 96 }} />,
};
