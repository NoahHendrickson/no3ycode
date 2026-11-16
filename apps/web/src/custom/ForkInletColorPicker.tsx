/** Inlet's colour swatches — see `.fork/customizations.yaml#fork-inlet-theme`. */

import { ForkSwatchPicker } from "./ForkSwatchPicker";
import { INLET_COLOR_OPTIONS, INLET_COLORS, type InletColor } from "./forkTheme";

const INLET_SWATCHES = INLET_COLORS.map((color) => ({
  value: color,
  label: INLET_COLOR_OPTIONS[color].label,
  swatch: INLET_COLOR_OPTIONS[color].swatch,
}));

export function ForkInletColorPicker(props: {
  readonly value: InletColor;
  readonly onChange: (color: InletColor) => void;
}) {
  return (
    <ForkSwatchPicker
      label="Inlet colour"
      options={INLET_SWATCHES}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
