export function ToggleField({
  label,
  checked,
  disabled,
  readOnly,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (value: boolean) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField label={label} value={checked} />;
  }

  return (
    <label className="mp-custom-setting">
      <span>{label}</span>
      <button
        className={`mp-custom-toggle ${checked ? "is-on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        type="button"
      >
        {checked ? "ON" : "OFF"}
      </button>
    </label>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  readOnly,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField label={label} value={value} />;
  }

  return (
    <label className="mp-custom-setting">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField label={label} value={value} />;
  }

  return (
    <label className="mp-custom-setting mp-custom-setting--wide">
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}

export function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="mp-custom-setting mp-custom-setting--readonly">
      <span>{label}</span>
      <strong>
        {typeof value === "boolean" ? (value ? "ON" : "OFF") : value ?? "NONE"}
      </strong>
    </div>
  );
}
