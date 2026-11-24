// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=242-1016
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/chat/ComposerFooterControls.tsx
// component=ComposerPermissionsSection
import figma from "figma";

// The permissions chip's menu body; the picked mode and its description come from runtimeMode.
export default {
  example: figma.tsx`<ComposerPermissionsSection
  runtimeMode={props.runtimeMode}
  runtimeModeOptions={props.runtimeModeOptions}
  onRuntimeModeChange={props.onRuntimeModeChange}
/>`,
  imports: [
    'import { ComposerPermissionsSection } from "~/components/chat/ComposerFooterControls";',
  ],
  id: "permissions-menu",
};
