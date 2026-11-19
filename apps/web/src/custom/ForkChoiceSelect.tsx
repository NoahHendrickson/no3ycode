/**
 * A Settings row's pick-one control for a fork setting stored as a string union.
 */
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function ForkChoiceSelect<T extends string>(props: {
  readonly value: T;
  readonly options: readonly T[];
  readonly labels: Readonly<Record<T, string>>;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
}) {
  const { value, options, labels, onChange, ariaLabel } = props;
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const picked = options.find((option) => option === next);
        if (picked !== undefined) onChange(picked);
      }}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label={ariaLabel}>
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem hideIndicator key={option} value={option}>
            {labels[option]}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
