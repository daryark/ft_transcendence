// components/ModeLayout/ModeLayout.tsx
import { useNavigate } from "react-router-dom";
import BackButton from "../BackButton/BackButton";
import "./ModeLayout.scss";

interface ModeLayoutProps {
  title: string;
  description: string | string[];
  accentColor: string;
  personalBest?: string;
  showMusic?: boolean;
  onStart: () => void;
  options?: React.ReactNode;
  advanced?: React.ReactNode;
  tabs?: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export const ModeLayout: React.FC<ModeLayoutProps> = ({
  title,
  description,
  accentColor,
  personalBest,
  showMusic = true,
  onStart,
  options,
  advanced,
  tabs,
  headerExtra,
}) => {
  const navigate = useNavigate();
  const lines = Array.isArray(description) ? description : [description];

  return (
    <div
      className="mode-layout"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <BackButton />

      {/* Main block */}
      <div className="mode-layout__content">
        {/* Инфо-карточка */}
        <div className="mode-layout__info">
          <div className="mode-layout__info-left">
            <h2>{title}</h2>
            {lines.map((line, i) => (
              <p key={i}>{line}</p>
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

        {/* music + start */}
        <div className="mode-layout__start-row">
          {showMusic && (
            <div className="mode-layout__music">♪ RANDOM: CALM</div>
          )}
          <button className="mode-layout__start" onClick={onStart}>
            START
          </button>
        </div>

        {/* only custom */}
        {tabs}

        {options}

        {advanced}
      </div>
    </div>
  );
};
