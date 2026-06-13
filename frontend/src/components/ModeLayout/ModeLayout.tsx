import type { CSSProperties, ReactNode } from "react";
import BackButton from "../BackButton/BackButton";
import "./ModeLayout.scss";

interface ModeLayoutProps {
  title: string;
  description: string | string[];
  accentColor: string;
  personalBest?: string;
  showMusic?: boolean;
  onStart: () => void;
  isLoading?: boolean;
  options?: ReactNode;
  advanced?: ReactNode;
  tabs?: ReactNode;
  headerExtra?: ReactNode;
}

export function ModeLayout({
  title,
  description,
  accentColor,
  personalBest,
  onStart,
  isLoading = false,
  headerExtra,
}: ModeLayoutProps) {
  const lines = Array.isArray(description) ? description : [description];

  return (
    <div
      className="mode-layout"
      style={{ "--accent": accentColor } as CSSProperties}
    >
      <BackButton />

      <div className="mode-layout__content">
        <div className="mode-layout__info">
          <div className="mode-layout__info-left">
            <h2>{title}</h2>
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {personalBest && (
              <div className="mode-layout__pb">
                <span className="mode-layout__pb-label">PERSONAL BEST</span>
                <span className="mode-layout__pb-value">{personalBest}</span>
              </div>
            )}
          </div>
          {headerExtra && (
            <div className="mode-layout__info-right">{headerExtra}</div>
          )}
        </div>

        <div className="mode-layout__start-row">
          <button
            className="mode-layout__start"
            disabled={isLoading}
            onClick={onStart}
            type="button"
          >
            {isLoading ? "STARTING" : "START"}
          </button>
        </div>
      </div>
    </div>
  );
}
