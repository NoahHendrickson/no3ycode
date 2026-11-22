/**
 * The chip row above the thread composer on the no3y iPhone layout — see
 * `.fork/customizations.yaml#no3y-mobile-redesign`. The branch chip opens what the thread bar's
 * git, terminal and files items did; the access chip picks the runtime mode the thread settings
 * sheet sets, through the same composer draft settings.
 */
import GitBranchIcon from "@hugeicons/core-free-icons/GitBranchIcon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import ShieldOffIcon from "@hugeicons/core-free-icons/ShieldOffIcon";
import type { MenuAction } from "@react-native-menu/menu";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../src/components/ui/AppText";
import type { AppBarMenu, AppBarMenuItem } from "../src/components/ui/AppBar.types";
import * as Dialog from "../src/components/ui/Dialog";
import { Menu } from "../src/components/ui/Menu";
import { useAppearancePreferences } from "../src/features/settings/appearance/AppearancePreferencesProvider";
import {
  threadTerminalMenu,
  useThreadGitMenuDefinition,
  type ThreadGitControlsProps,
} from "../src/features/threads/ThreadGitControls";
import {
  compatibleRuntimeModeForChoices,
  runtimeModeChoicesForSupportedModes,
  withManagedRuntimeModeLimits,
} from "../src/features/threads/thread-settings-options";
import { buildModelOptions, serverConfigForCwd } from "../src/lib/modelOptions";
import { scopedThreadKey } from "../src/lib/scopedEntities";
import { useServerConfigs } from "../src/state/entities";
import {
  updateComposerDraftSettings,
  useComposerDraftSettings,
} from "../src/state/use-composer-drafts";
import { flatGlassPalette, NO3Y_FONT } from "./flatGlassTheme";
import { HugeIcon } from "./HugeIcon";
import { No3yGlassLayer } from "./No3yGlass";

const CHIP_HEIGHT = 32;

/** Native menu actions for app-bar menus, each menu an inline section; ids map to handlers. */
function menuActionsFor(menus: ReadonlyArray<AppBarMenu>) {
  const handlers = new Map<string, () => void>();
  const convert = (item: AppBarMenuItem, prefix: string): MenuAction => {
    const id = `${prefix}/${item.id}`;
    if ("items" in item) {
      return {
        id,
        title: item.title ?? "",
        ...(item.icon ? { image: item.icon } : {}),
        ...(item.inline ? { displayInline: true } : {}),
        subactions: item.items.map((child) => convert(child, id)),
      };
    }
    handlers.set(id, item.onPress);
    return {
      id,
      title: item.title,
      ...(item.subtitle ? { subtitle: item.subtitle } : {}),
      ...(item.icon ? { image: item.icon } : {}),
      ...(item.selected ? { state: "on" as const } : {}),
      attributes: { disabled: item.disabled === true, destructive: item.destructive === true },
    };
  };
  const actions = menus.map((menu, index): MenuAction => ({
    id: `menu-${index}`,
    title: menu.title,
    displayInline: true,
    subactions: menu.items.map((item) => convert(item, `menu-${index}`)),
  }));
  return { actions, handlers };
}

export function No3yThreadComposerChips(props: {
  readonly thread: EnvironmentThreadShell;
  readonly cwd: string | null;
  readonly gitControls: ThreadGitControlsProps;
  readonly onOpenFiles: (() => void) | null;
}) {
  const { themeAppearance } = useAppearancePreferences();
  const palette = flatGlassPalette(themeAppearance);
  const { thread, gitControls } = props;
  const gitMenu = useThreadGitMenuDefinition(gitControls);
  const terminalMenu = threadTerminalMenu(gitControls);
  const config = useServerConfigs().get(thread.environmentId) ?? null;
  const threadKey = scopedThreadKey(thread.environmentId, thread.id);
  const draftSettings = useComposerDraftSettings(threadKey);

  const filesMenu: AppBarMenu | null =
    props.onOpenFiles && gitControls.canOpenFiles
      ? {
          title: "Files",
          icon: "folder",
          items: [{ id: "files", title: "Open files", icon: "folder", onPress: props.onOpenFiles }],
        }
      : null;
  const branchMenu = menuActionsFor(
    [gitMenu, terminalMenu, filesMenu].filter((menu): menu is AppBarMenu => menu !== null),
  );
  const branchLabel = gitControls.gitStatus?.refName ?? gitControls.currentBranch ?? thread.branch;

  const modelSelection = draftSettings.modelSelection ?? thread.modelSelection;
  const modelOption =
    buildModelOptions(
      serverConfigForCwd(config, props.cwd),
      modelSelection,
      undefined,
      thread.projectId,
    ).find(
      (option) =>
        option.selection.instanceId === modelSelection.instanceId &&
        option.selection.model === modelSelection.model,
    ) ?? null;
  const runtimeChoices = withManagedRuntimeModeLimits(
    runtimeModeChoicesForSupportedModes(modelOption?.supportedRuntimeModes),
    [config?.managedPolicy],
  );
  const runtimeMode = compatibleRuntimeModeForChoices(
    draftSettings.runtimeMode ?? thread.runtimeMode,
    runtimeChoices,
  );
  const runtimeLabel = runtimeChoices.find((choice) => choice.mode === runtimeMode)?.label;

  const chip = {
    height: CHIP_HEIGHT,
    borderRadius: CHIP_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 }}>
      {branchLabel || branchMenu.actions.length > 0 ? (
        <Menu
          title={branchLabel ?? "Git"}
          actions={branchMenu.actions}
          onPressAction={({ nativeEvent }) => branchMenu.handlers.get(nativeEvent.event)?.()}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={branchLabel ? `Branch ${branchLabel}` : "Git"}
            style={{ ...chip, flexDirection: "row", gap: 8, paddingHorizontal: 10, maxWidth: 240 }}
          >
            <No3yGlassLayer radius={CHIP_HEIGHT / 2} />
            <HugeIcon icon={GitBranchIcon} size={16} color={palette.foreground} />
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                ...NO3Y_FONT.regular,
                fontSize: 12,
                color: palette.foreground,
              }}
            >
              {branchLabel ?? "No branch"}
            </Text>
          </Pressable>
        </Menu>
      ) : null}
      <Menu
        title="Access"
        actions={runtimeChoices.map((choice) => ({
          id: choice.mode,
          title: choice.label,
          subtitle: choice.disabledReason ?? choice.description,
          state: choice.mode === runtimeMode ? ("on" as const) : ("off" as const),
          attributes: { disabled: choice.disabledReason !== undefined },
        }))}
        onPressAction={({ nativeEvent }) => {
          const choice = runtimeChoices.find((candidate) => candidate.mode === nativeEvent.event);
          if (!choice) return;
          if (choice.disabledReason) {
            Dialog.alert(choice.label, choice.disabledReason);
            return;
          }
          updateComposerDraftSettings(threadKey, { runtimeMode: choice.mode });
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Access: ${runtimeLabel ?? runtimeMode}`}
          style={{ ...chip, width: CHIP_HEIGHT }}
        >
          <No3yGlassLayer radius={CHIP_HEIGHT / 2} />
          <HugeIcon
            icon={runtimeMode === "full-access" ? ShieldOffIcon : Shield01Icon}
            size={16}
            color={palette.foreground}
            filled
          />
        </Pressable>
      </Menu>
    </View>
  );
}
