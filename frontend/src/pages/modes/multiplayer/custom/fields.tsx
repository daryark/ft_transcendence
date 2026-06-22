export function ToggleField({
  label,
  checked,
  disabled,
  readOnly,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField hint={hint} label={label} value={checked} />;
  }

  return (
    <label className="mp-custom-setting" data-hint={hint || undefined}>
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
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  hint?: string;
  onChange: (value: number) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField hint={hint} label={label} value={value} />;
  }

  const rangeHint = [
    min !== undefined ? `min ${min}` : "",
    max !== undefined ? `max ${max}` : "",
  ].filter(Boolean).join(" / ");
  const fullHint = [hint, rangeHint ? `Range: ${rangeHint}.` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="mp-custom-setting" data-hint={fullHint || undefined}>
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
  hint,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  hint?: string;
  onChange: (value: string) => void;
}) {
  if (readOnly) {
    return <ReadOnlyField hint={hint} label={label} value={value} />;
  }

  return (
    <label
      className="mp-custom-setting mp-custom-setting--wide"
      data-hint={hint || undefined}
    >
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
  hint,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  hint?: string;
}) {
  return (
    <div
      className="mp-custom-setting mp-custom-setting--readonly"
      data-hint={hint || undefined}
    >
      <span>{label}</span>
      <strong>
        {typeof value === "boolean" ? (value ? "ON" : "OFF") : value ?? "NONE"}
      </strong>
    </div>
  );
}
