import { useEffect, useState, type CSSProperties } from "react";

import { addXpPopupListener, type XpPopupDetail } from "./xpPopupEvents";
import "./XpPopup.scss";

const POPUP_LIFETIME_MS = 2600;

export default function XpPopup() {
  const [popup, setPopup] = useState<
    (XpPopupDetail & { id: number }) | null
  >(null);

  useEffect(() => {
    const handlePopup = (event: Event) => {
      const detail = (event as CustomEvent<XpPopupDetail>).detail;
      if (!detail?.amount) return;

      const id = Date.now();
      setPopup({
        id,
        amount: detail.amount,
        label: detail.label,
        level: detail.level,
        xp: detail.xp,
        nextLevelXp: detail.nextLevelXp,
        leveledUp: detail.leveledUp,
        variant: detail.variant ?? "xp",
      });
      window.setTimeout(() => {
        setPopup((current) => (current?.id === id ? null : current));
      }, POPUP_LIFETIME_MS);
    };

    return addXpPopupListener(handlePopup);
  }, []);

  if (!popup) return null;
  const hasLevelProgress =
    popup.variant !== "ko" &&
    Number.isFinite(popup.xp) &&
    Number.isFinite(popup.nextLevelXp) &&
    (popup.nextLevelXp ?? 0) > 0;
  const progressPercent = hasLevelProgress
    ? Math.min(100, Math.max(0, ((popup.xp ?? 0) / (popup.nextLevelXp ?? 1)) * 100))
    : 0;

  return (
    <div
      key={popup.id}
      className={`xp-popup xp-popup--${popup.variant ?? "xp"}`}
      aria-live="polite"
    >
      <strong>{popup.label ?? `+${popup.amount.toLocaleString()} XP`}</strong>
      {hasLevelProgress && (
        <div className="xp-popup__level">
          <span>
            {popup.leveledUp ? "LEVEL UP!" : `LEVEL ${popup.level ?? 1}`}
          </span>
          <div className="xp-popup__bar">
            <i style={{ "--xp-progress": `${progressPercent}%` } as CSSProperties} />
          </div>
        </div>
      )}
    </div>
  );
}
