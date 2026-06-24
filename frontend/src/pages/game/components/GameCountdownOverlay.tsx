type GameCountdownOverlayProps = {
  value: string;
  variant?: "number" | "warning";
};

export default function GameCountdownOverlay({
  value,
  variant,
}: GameCountdownOverlayProps) {
  const modifier =
    variant === "warning"
      ? " solo-game__countdown--number solo-game__countdown--warning"
      : variant === "number"
        ? " solo-game__countdown--number"
        : "";

  return (
    <div className={`solo-game__countdown${modifier}`} aria-live="polite">
      {value}
    </div>
  );
}
