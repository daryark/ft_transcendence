type GameFocusOverlayProps = {
  active: boolean;
};

export default function GameFocusOverlay({ active }: GameFocusOverlayProps) {
  if (!active) return null;

  return (
    <div className="solo-game__focus-warning" role="alert">
      <strong>OUT OF FOCUS</strong>
      <span>CLICK TO RETURN TO TETRIS</span>
    </div>
  );
}
