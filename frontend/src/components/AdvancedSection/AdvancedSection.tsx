import { useState } from "react";
export const AdvancedSection: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="advanced-section">
      <button
        className="advanced-section__toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span>{open ? "▲" : "▼"}</span> ADVANCED
      </button>
      {open && (
        <div className="advanced-section__body">
          {children ?? <p>No advanced options.</p>}
        </div>
      )}
    </div>
  );
};