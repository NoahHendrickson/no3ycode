import { AppBar } from "../../components/ui/AppBar";
import type { AppBarAction, AppBarMenu } from "../../components/ui/AppBar.types";
import {
  useAdaptiveWorkspaceLayout,
  useWorkspacePaneState,
} from "../layout/AdaptiveWorkspaceLayout";
import type { ThreadInspectorMode } from "./thread-inspector-navigation";
import { useWorkspaceBackNavigation } from "../layout/workspace/useAndroidWorkspaceNavigation";
import {
  threadTerminalMenu,
  useThreadGitMenuDefinition,
  type ThreadGitControlsProps,
} from "./ThreadGitControls";
/* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
import type { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { No3yThreadHeader, useNo3yThreadBar } from "../../../fork/No3yScreenHeader";
/* fork:end no3y-mobile-redesign */

export function ThreadHeader(props: {
  readonly title: string;
  readonly subtitle: string;
  readonly gitControls: ThreadGitControlsProps;
  readonly onReturnToThread?: () => void;
  readonly draft?: boolean;
  readonly hasThreadCwd: boolean;
  readonly inspectorMode: ThreadInspectorMode | null;
  readonly onOpenFilesInspector: () => void;
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  /** The no3y iPhone bar: a usage button, and a ⋯ menu holding the subtitle and the bar's items. */
  readonly no3yUsage?: {
    readonly environmentId: EnvironmentId;
    readonly providerInstanceId: ProviderInstanceId;
  };
  /* fork:end no3y-mobile-redesign */
}) {
  const goBack = useWorkspaceBackNavigation();
  const { toggleAuxiliaryPane, startNewTask } = useAdaptiveWorkspaceLayout();
  const { panes } = useWorkspacePaneState();
  const gitMenu = useThreadGitMenuDefinition(props.gitControls);
  const terminalMenu = threadTerminalMenu(props.gitControls);
  const filesVisible = props.inspectorMode === "files" && panes.auxiliaryPaneVisible;
  const actions: AppBarAction[] = props.hasThreadCwd
    ? [
        {
          accessibilityLabel: filesVisible ? "Close files" : "Open files",
          icon: "folder",
          selected: filesVisible,
          disabled: !props.gitControls.canOpenFiles,
          separateBackground: false,
          onPress: filesVisible ? toggleAuxiliaryPane : props.onOpenFilesInspector,
        },
      ]
    : [];
  const menus = [gitMenu, terminalMenu].filter((menu): menu is AppBarMenu => menu !== null);
  /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
  const no3yBar = useNo3yThreadBar(
    props.draft || !props.no3yUsage
      ? undefined
      : {
          ...props.no3yUsage,
          subtitle: props.subtitle,
          branch: props.gitControls.gitStatus?.refName ?? props.gitControls.currentBranch,
          menus: [gitMenu, terminalMenu],
          openFiles:
            props.hasThreadCwd && props.gitControls.canOpenFiles
              ? props.onOpenFilesInspector
              : null,
        },
  );
  // The no3y bar floats over the transcript in place of the native bar.
  if (no3yBar) return <No3yThreadHeader title={props.title} onBack={goBack} bar={no3yBar} />;
  /* fork:end no3y-mobile-redesign */

  return (
    <AppBar
      title={props.title}
      subtitle={props.subtitle}
      onBackToList={goBack}
      onCompose={props.draft ? undefined : startNewTask}
      backInSplitView={
        props.onReturnToThread
          ? {
              accessibilityLabel: "Return to chat",
              icon: "chevron.left",
              onPress: props.onReturnToThread,
            }
          : undefined
      }
      actions={actions}
      menus={menus}
      hideBottomBorder
    />
  );
}
