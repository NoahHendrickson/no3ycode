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
import { useNo3yThreadHeaderTrailing } from "../../../fork/No3yScreenHeader";
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
  /** The no3y iPhone bar swaps the git, terminal and files items (now on the branch chip) for usage. */
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
  const no3yTrailing = useNo3yThreadHeaderTrailing(props.draft ? undefined : props.no3yUsage);
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
      /* fork:begin no3y-mobile-redesign — see .fork/customizations.yaml#no3y-mobile-redesign */
      actions={no3yTrailing ? [] : actions}
      menus={no3yTrailing ? [] : menus}
      trailing={no3yTrailing}
      /* fork:end no3y-mobile-redesign */
      hideBottomBorder
    />
  );
}
