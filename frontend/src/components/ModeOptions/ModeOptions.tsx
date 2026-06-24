import { useState } from "react";
interface Option {
  id: string;
  label: string;
}

interface Props {
  items: Option[];
}

export const ModeOptions: React.FC<Props> = ({ items }) => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="mode-options">
      <h3>OPTIONS</h3>
      {items.map(opt => (
        <label key={opt.id} className="mode-options__item">
          <input
            type="checkbox"
            checked={!!checked[opt.id]}
            onChange={() => toggle(opt.id)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
};