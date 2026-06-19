import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import "./Toast.scss";

type ToastTone = "info" | "success" | "error";

export type AchievementToast = {
  id: number;
  name: string;
  description: string;
  rarity: "common" | "rare" | "epic";
};

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  achievement?: AchievementToast;
  onClick?: () => void;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone, onClick?: () => void) => void;
  showAchievement: (achievement: AchievementToast) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "info", onClick?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone, onClick }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const showAchievement = useCallback((achievement: AchievementToast) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [
      ...current,
      {
        id,
        message: achievement.name,
        tone: "success",
        achievement,
      },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 6500);
  }, []);

  const value = useMemo(
    () => ({ showToast, showAchievement }),
    [showAchievement, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <button
            className={`toast toast--${toast.tone} ${
              toast.achievement
                ? `toast--achievement toast--${toast.achievement.rarity}`
                : ""
            }`}
            key={toast.id}
            onClick={() => {
              setToasts((current) =>
                current.filter((item) => item.id !== toast.id),
              );
              toast.onClick?.();
            }}
            type="button"
          >
            {toast.achievement ? (
              <>
                <span className="toast__achievement-icon">
                  {toast.achievement.id}
                </span>
                <span className="toast__achievement-content">
                  <small>Achievement unlocked</small>
                  <strong>{toast.achievement.name}</strong>
                  <span>{toast.achievement.description}</span>
                  <em>{toast.achievement.rarity}</em>
                </span>
              </>
            ) : (
              toast.message
            )}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
