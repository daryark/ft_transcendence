const XP_POPUP_EVENT = "tetra:xp-popup";

export type XpPopupDetail = {
  amount: number;
};

export function emitXpPopup(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return;

  window.dispatchEvent(
    new CustomEvent<XpPopupDetail>(XP_POPUP_EVENT, {
      detail: { amount: Math.round(amount) },
    }),
  );
}

export function addXpPopupListener(listener: (event: Event) => void) {
  window.addEventListener(XP_POPUP_EVENT, listener);
  return () => window.removeEventListener(XP_POPUP_EVENT, listener);
}
