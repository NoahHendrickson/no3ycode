import { usePreviewPanelInlineSize } from "../../hooks/usePreviewPanelInlineSize";
import { RightPanelSheet } from "../RightPanelSheet";
import { RightPanelTabs, type RightPanelTabsProps } from "../RightPanelTabs";
/* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */
import { useRightPanelWidthKey } from "../../custom/music/musicKeepOpen";
/* fork:end fork-music-panel */

type ChatRightPanelProps = Omit<RightPanelTabsProps, "mode" | "inlineSize" | "maximized"> & {
  readonly sheet: boolean;
  readonly maximized: boolean;
  readonly workspaceLayoutElement: HTMLElement | null;
  readonly widthStorageKey: string;
  /* fork:begin fork-design-mode — see .fork/customizations.yaml#fork-design-mode */
  readonly minWidth?: number | undefined;
  /* fork:end fork-design-mode */
  readonly sheetAnimationDurationMs: number;
  readonly onCloseSheet: () => void;
};

/**
 * The right panel, inline beside the chat column or as a sheet on narrow
 * layouts. Its width follows a resize drag every frame, so the width state
 * lives here rather than in ChatView.
 */
export function ChatRightPanel(props: ChatRightPanelProps) {
  const {
    sheet,
    workspaceLayoutElement,
    widthStorageKey,
    /* fork:begin fork-design-mode — see .fork/customizations.yaml#fork-design-mode */
    minWidth,
    /* fork:end fork-design-mode */
    sheetAnimationDurationMs,
    onCloseSheet,
    maximized,
    layoutControls,
    ...tabs
  } = props;
  /* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */
  const sharedWidthKey = useRightPanelWidthKey(widthStorageKey);
  /* fork:end fork-music-panel */
  const inlineSize = usePreviewPanelInlineSize({
    container: workspaceLayoutElement,
    /* fork:begin fork-music-panel — see .fork/customizations.yaml#fork-music-panel */
    widthStorageKey: sharedWidthKey,
    /* fork:end fork-music-panel */
    /* fork:begin fork-design-mode — see .fork/customizations.yaml#fork-design-mode */
    minWidth,
    /* fork:end fork-design-mode */
  });
  if (!sheet) {
    return <RightPanelTabs {...tabs} mode="inline" maximized={maximized} inlineSize={inlineSize} />;
  }
  return (
    <RightPanelSheet
      animationDurationMs={sheetAnimationDurationMs}
      open={tabs.open === true}
      onClose={onCloseSheet}
    >
      <RightPanelTabs
        {...tabs}
        mode="sheet"
        inlineSize={inlineSize}
        layoutControls={layoutControls}
      />
    </RightPanelSheet>
  );
}
