// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=72-955
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/ChangedFilesTree.tsx
// component=ChangedFilesCard
import figma from "figma";

// The card at the end of a turn (TimelineAssistantRows.tsx): its rows, counts and totals come
// from the turn's checkpoint files.
export default {
  example: figma.tsx`<ChangedFilesCard
  runId={turnSummary.runId}
  files={checkpointFiles}
  totals={checkpointFileTotals(turnSummary)}
  allDirectoriesExpanded={allDirectoriesExpanded}
  resolvedTheme={resolvedTheme}
  onToggleAllDirectories={onToggleAllDirectories}
  onOpenTurnDiff={onOpenTurnDiff}
  onFileContextMenu={onFileContextMenu}
/>`,
  imports: ['import { ChangedFilesCard } from "~/components/chat/ChangedFilesTree";'],
  id: "changed-files-card",
};
