import type { ComponentProps, ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowUpRightIcon } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { forcedStateProps } from "../forcedStates.ts";

type Tone = "success" | "error" | "warning" | "info" | "secondary";

const RUNS: ReadonlyArray<{
  status: string;
  tone: Tone;
  title: string;
  thread: string;
  project: string;
  pullRequest: string | null;
  trigger: string;
  started: string;
  duration: string;
}> = [
  {
    status: "Running",
    tone: "info",
    title: "Nightly dependency bump",
    thread: "Bump effect to 4.1",
    project: "t3code",
    pullRequest: null,
    trigger: "Schedule",
    started: "2m ago",
    duration: "Running",
  },
  {
    status: "Completed",
    tone: "success",
    title: "Triage new issues",
    thread: "Label 6 issues and close 2 duplicates",
    project: "t3code",
    pullRequest: "#2841",
    trigger: "Webhook",
    started: "1h ago",
    duration: "4m 12s",
  },
  {
    status: "Failed",
    tone: "error",
    title: "Weekly flaky test sweep",
    thread: "Quarantine the diff highlighter test",
    project: "mobile",
    pullRequest: null,
    trigger: "Schedule",
    started: "Yesterday",
    duration: "11m 40s",
  },
  {
    status: "Waiting",
    tone: "warning",
    title: "Release notes draft",
    thread: "Draft notes for 0.12",
    project: "marketing",
    pullRequest: "#310",
    trigger: "Run now",
    started: "2d ago",
    duration: "—",
  },
  {
    status: "Cancelled",
    tone: "secondary",
    title: "Docs link check",
    thread: "Check links in docs/user",
    project: "t3code",
    pullRequest: null,
    trigger: "Schedule",
    started: "3d ago",
    duration: "—",
  },
];

function RunsHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Automation</TableHead>
        <TableHead>Project</TableHead>
        <TableHead>Pull request</TableHead>
        <TableHead>Trigger</TableHead>
        <TableHead>Started</TableHead>
        <TableHead>Duration</TableHead>
        <TableHead>
          <span className="sr-only">Open</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

function RunRow({
  run,
  ...props
}: { run: (typeof RUNS)[number] } & ComponentProps<typeof TableRow>) {
  return (
    <TableRow className="cursor-pointer" tabIndex={0} {...props}>
      <TableCell>
        <Badge variant={run.tone}>{run.status}</Badge>
      </TableCell>
      <TableCell className="max-w-96 whitespace-normal">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{run.title}</span>
          <span className="truncate text-muted-foreground">{run.thread}</span>
        </div>
      </TableCell>
      <TableCell className="max-w-48 truncate text-muted-foreground">{run.project}</TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {run.pullRequest ? (
          <a href="#" className="underline underline-offset-2 hover:text-foreground">
            {run.pullRequest}
          </a>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{run.trigger}</TableCell>
      <TableCell className="text-muted-foreground">{run.started}</TableCell>
      <TableCell className="text-muted-foreground">{run.duration}</TableCell>
      <TableCell className="text-right text-muted-foreground">
        <ArrowUpRightIcon className="inline size-3.5" aria-hidden />
      </TableCell>
    </TableRow>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 dark:bg-card/30">
      {children}
    </div>
  );
}

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: { surface: "bare" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ScheduledRuns: Story = {
  name: "Scheduled runs",
  render: () => (
    <Card>
      <Table>
        <RunsHeader />
        <TableBody>
          {RUNS.map((run) => (
            <RunRow key={run.title} run={run} />
          ))}
        </TableBody>
      </Table>
    </Card>
  ),
};

export const RowStates: Story = {
  name: "Row states",
  render: () => (
    <Card>
      <Table>
        <RunsHeader />
        <TableBody>
          <RunRow run={RUNS[1]!} />
          <RunRow run={RUNS[2]!} {...forcedStateProps("hover")} />
          <RunRow run={RUNS[3]!} data-state="selected" />
          <RunRow run={RUNS[4]!} {...forcedStateProps("focus")} />
        </TableBody>
      </Table>
    </Card>
  ),
};

export const Notices: Story = {
  name: "Notice rows",
  render: () => (
    <Card>
      <Table>
        <RunsHeader />
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={8} className="text-muted-foreground">
              MacBook Pro
            </TableCell>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={8} className="text-muted-foreground" role="status">
              This automation has not run yet.
            </TableCell>
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={8} className="text-destructive" role="status">
              Could not load runs from this environment.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  ),
};
