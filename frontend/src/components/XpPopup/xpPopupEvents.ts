const XP_POPUP_EVENT = "tetra:xp-popup";

export type XpPopupDetail = {
  amount: number;
  label?: string;
  level?: number;
  xp?: number;
  nextLevelXp?: number;
  leveledUp?: boolean;
  variant?: "xp" | "ko";
};

export function emitXpPopup(amount: number, options: Omit<XpPopupDetail, "amount"> = {}) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  window.dispatchEvent(
    new CustomEvent<XpPopupDetail>(XP_POPUP_EVENT, {
      detail: { amount: Math.round(amount), ...options },
    }),
  );
}

export function emitKoPopup() {
  window.dispatchEvent(
    new CustomEvent<XpPopupDetail>(XP_POPUP_EVENT, {
      detail: { amount: 1, label: "KO", variant: "ko" },
    }),
  );
}

export function addXpPopupListener(listener: (event: Event) => void) {
  window.addEventListener(XP_POPUP_EVENT, listener);
  return () => window.removeEventListener(XP_POPUP_EVENT, listener);
}
