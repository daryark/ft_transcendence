import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Dialog from "../Dialog/Dialog";
import "./Confirm.scss";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback(
    (confirmed: boolean) => {
      pending?.resolve(confirmed);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <Dialog label={pending.title} onClose={() => close(false)}>
          <section className="confirm-dialog">
            <h2>{pending.title}</h2>
            <p>{pending.message}</p>
            <div>
              <button onClick={() => close(false)} type="button">
                CANCEL
              </button>
              <button onClick={() => close(true)} type="button">
                {pending.confirmLabel ?? "CONFIRM"}
              </button>
            </div>
          </section>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside ConfirmProvider");
  return context;
}
