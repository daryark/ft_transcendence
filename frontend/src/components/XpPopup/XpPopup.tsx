import { useEffect, useState } from "react";

import { addXpPopupListener, type XpPopupDetail } from "./xpPopupEvents";
import "./XpPopup.scss";

const POPUP_LIFETIME_MS = 2600;

export default function XpPopup() {
  const [popup, setPopup] = useState<{ id: number; amount: number } | null>(
    null,
  );

  useEffect(() => {
    const handlePopup = (event: Event) => {
      const detail = (event as CustomEvent<XpPopupDetail>).detail;
      if (!detail?.amount) return;

      const id = Date.now();
      setPopup({ id, amount: detail.amount });
      window.setTimeout(() => {
        setPopup((current) => (current?.id === id ? null : current));
      }, POPUP_LIFETIME_MS);
    };

    return addXpPopupListener(handlePopup);
  }, []);

  if (!popup) return null;

  return (
    <div key={popup.id} className="xp-popup" aria-live="polite">
      +{popup.amount.toLocaleString()} XP
    </div>
  );
}
