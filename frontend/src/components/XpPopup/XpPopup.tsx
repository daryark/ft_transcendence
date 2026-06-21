import { useEffect, useState } from "react";

import { addXpPopupListener, type XpPopupDetail } from "./xpPopupEvents";
import "./XpPopup.scss";

const POPUP_LIFETIME_MS = 2600;

export default function XpPopup() {
  const [popup, setPopup] = useState<
    { id: number; amount: number; label?: string; variant?: "xp" | "ko" } | null
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
        variant: detail.variant ?? "xp",
      });
      window.setTimeout(() => {
        setPopup((current) => (current?.id === id ? null : current));
      }, POPUP_LIFETIME_MS);
    };

    return addXpPopupListener(handlePopup);
  }, []);

  if (!popup) return null;

  return (
    <div
      key={popup.id}
      className={`xp-popup xp-popup--${popup.variant ?? "xp"}`}
      aria-live="polite"
    >
      {popup.label ?? `+${popup.amount.toLocaleString()} XP`}
    </div>
  );
}
