type GameAbortOverlayProps = {
  progress: number;
};

export default function GameAbortOverlay({
  progress,
}: GameAbortOverlayProps) {
  return (
    <div className="solo-game__abort" aria-hidden={progress === 0}>
      <div
        className="solo-game__abort__bar"
        style={{ height: `${progress * 100}%` }}
      />
      {progress > 0 && (
        <div className="solo-game__abort__text">
          Keep pressing ESC to exit
        </div>
      )}
    </div>
  );
}
