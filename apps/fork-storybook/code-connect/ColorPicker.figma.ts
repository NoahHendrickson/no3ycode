// url=https://www.figma.com/design/kUDQTOR0ndxERlBCqgy3nk/no3y-code-%E2%80%94-Basic-UI-kit?node-id=66-136
// source=https://github.com/NoahHendrickson/no3ycode/blob/custom/apps/web/src/components/ui/color-picker.tsx
// component=ColorSaturationValuePlane
import figma from "figma";

// The plane and the hue slider under it, as the provider accent picker pairs them
// (ProviderAccentColorPicker.tsx).
export default {
  example: figma.tsx`<ColorSaturationValuePlane
  label="Accent color"
  value={hsv}
  onChange={changeHsv}
  onInteractionEnd={endDrag}
  variant="edge"
/>
<ColorHueSlider
  label="Accent color hue"
  value={hsv.h}
  onChange={(h) => changeHsv({ ...hsv, h })}
  onInteractionEnd={endDrag}
/>`,
  imports: [
    'import { ColorHueSlider, ColorSaturationValuePlane } from "~/components/ui/color-picker";',
  ],
  id: "color-picker",
};
