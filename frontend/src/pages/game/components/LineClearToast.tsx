import type { LineClearEvent } from "../types";

type LineClearToastProps = {
  event?: LineClearEvent;
  eventKey?: string | number;
};

export default function LineClearToast({
  event,
  eventKey,
}: LineClearToastProps) {
  if (!event) return null;

  return (
    <div className="line-clear-toast" aria-live="polite">
      <div
        className={`line-clear-toast__clear line-clear-toast__clear--${event.label.toLowerCase()}`}
        key={`clear-${eventKey ?? event.id}`}
      >
        <strong>{event.label}</strong>
        <span>
          {event.backToBack > 1
            ? `B2B x${event.backToBack}`
            : null}
          {event.backToBack > 1 && event.combo > 1
            ? " / "
            : null}
          {event.combo > 1 ? `${event.combo} COMBO` : null}
        </span>
      </div>
    </div>
  );
}
