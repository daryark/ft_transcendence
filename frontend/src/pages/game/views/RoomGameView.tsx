import { useEffect, useState, type CSSProperties } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import { formatPlayerName, getModeLabel } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GameFocusOverlay from "../components/GameFocusOverlay";
import GameGarbageQueue from "../components/GameGarbageQueue";
import GamePreviewPanel from "../components/GamePreviewPanel";

type RoomGameViewProps = {
  session: GameSession;
};

const TABLET_BREAKPOINT_PX = 860;
const ROOM_PACKAGE_SCALE_FLOOR = 0.74;
const ROOM_BASE_WIDTH_PX = 46 * 16;
const ROOM_BASE_HEIGHT_PX = 44 * 16;

function StockCrystals({
  stockLeft,
  stockTotal,
}: {
  stockLeft?: number;
  stockTotal?: number;
}) {
  const total = Math.max(1, Math.floor(stockTotal ?? 1));
  if (total <= 1) return null;

  const active = Math.max(0, Math.min(total, Math.floor(stockLeft ?? 0) + 1));

  return (
    <div className="room-game__stocks" aria-label={`${active} stock left`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          className={index < active ? "is-active" : ""}
          key={`stock-${index}`}
        />
      ))}
    </div>
  );
}

const QUICKPLAY_FLOORS = [
  { name: "HALL OF BEGINNINGS", min: 0, className: "floor-1" },
  { name: "THE HOTEL", min: 50, className: "floor-2" },
  { name: "THE CASINO", min: 150, className: "floor-3" },
  { name: "THE ARENA", min: 300, className: "floor-4" },
  { name: "THE MUSEUM", min: 450, className: "floor-5" },
  { name: "ABANDONED OFFICES", min: 650, className: "floor-6" },
  { name: "THE LABORATORY", min: 850, className: "floor-7" },
  { name: "THE CORE", min: 1100, className: "floor-8" },
  { name: "CORRUPTION", min: 1350, className: "floor-9" },
  { name: "PLATFORM OF THE GODS", min: 1650, className: "floor-10" },
];

function getQuickplayMeters(player: { quickplayMeters?: number }) {
  return Number((player.quickplayMeters ?? 0).toFixed(1));
}

function getQuickplayFloor(meters: number) {
  return QUICKPLAY_FLOORS.reduce(
    (current, floor) => (meters >= floor.min ? floor : current),
    QUICKPLAY_FLOORS[0],
  );
}

function getRoomPackageScale() {
  if (window.innerWidth <= TABLET_BREAKPOINT_PX) {
    return ROOM_PACKAGE_SCALE_FLOOR;
  }

  const widthScale = (window.innerWidth - 64) / ROOM_BASE_WIDTH_PX;
  const heightScale = (window.innerHeight - 120) / ROOM_BASE_HEIGHT_PX;
  return Math.min(
    1,
    Math.max(ROOM_PACKAGE_SCALE_FLOOR, Math.min(widthScale, heightScale)),
  );
}

export default function RoomGameView({ session }: RoomGameViewProps) {
  const {
    alivePlayers,
    eliminatedPlayers,
    gameConfig,
    gameState,
    isSpectating,
    selfPlayer,
  } = session;
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(
    null,
  );
  const [packageScale, setPackageScale] = useState(getRoomPackageScale);

  useEffect(() => {
    const updateScale = () => setPackageScale(getRoomPackageScale());

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (!gameState || !gameConfig || gameConfig.mode === "solo") return null;

  const selectedTarget = alivePlayers.find(
    (player) => String(player.id) === selectedTargetId,
  );
  const targetPlayer = isSpectating
    ? selectedTarget ?? alivePlayers[0]
    : selfPlayer;
  const targetState = targetPlayer?.state ?? gameState;
  const targetConfig = targetPlayer?.config ?? gameConfig;
  const quickplayStats =
    gameConfig.mode === "quickplay"
      ? targetState.update.quickplay ?? targetState.quickplay
      : null;
  const previewPlayers = alivePlayers.filter(
    (player) => String(player.id) !== String(targetPlayer?.id),
  );
  const opponentCellSize =
    previewPlayers.length <= 2 ? 13 : previewPlayers.length <= 3 ? 10 : 8;
  const mainCellSize = Math.round(32 * packageScale);
  const previewFigureSize = Math.round(30 * packageScale);
  const isQuickplay = gameConfig.mode === "quickplay";
  const targetMeters = targetPlayer ? getQuickplayMeters(targetPlayer) : 0;
  const quickplayFloor = getQuickplayFloor(targetMeters);
  const quickplayPlayers = [...alivePlayers]
    .sort((a, b) => getQuickplayMeters(b) - getQuickplayMeters(a));
  const style = {
    "--room-package-scale": String(packageScale),
  } as CSSProperties;

  return (
    <main
      className={`solo-game room-game${
        isQuickplay
          ? ` room-game--quickplay room-game--${quickplayFloor.className}`
          : ` room-game--${gameConfig.mode}`
      }`}
      style={style}
    >
      <header className="versus-game__topbar">
        <div className="versus-game__live">LIVE</div>
        <div className="versus-game__title">
          {isSpectating ? "SPECTATING" : getModeLabel(gameConfig)}{" "}
          <strong>
            {formatPlayerName(targetPlayer?.username, "PLAYER")}
          </strong>
          <span className="room-game__population">
            {isQuickplay
              ? `${quickplayPlayers.length} PLAYING`
              : `${alivePlayers.length} ALIVE`}
            {eliminatedPlayers.length > 0 &&
              ` / ${eliminatedPlayers.length} OUT`}
          </span>
        </div>
        {gameConfig.mode === "custom" && isSpectating && (
          <button
            className="versus-game__exit"
            onClick={session.leaveActiveGameView}
            type="button"
          >
            LOBBY
          </button>
        )}
      </header>

      <section className="room-game__stage">
        <div className="room-game__self">
          <div className="room-game__left-rail">
            {targetConfig.controls.hold && (
              <GamePreviewPanel
                className="solo-game__panel room-game__hold"
                figureSize={previewFigureSize}
                state={targetState}
                type="hold"
              />
            )}
            <div className="room-game__stats" aria-label="Player stats">
              {quickplayStats ? (
                <>
                  <div>
                    <span>ALTITUDE</span>
                    <strong
                      className="game-stat-pop"
                      key={`altitude-${quickplayStats.meters.toFixed(1)}`}
                    >
                      {quickplayStats.meters.toFixed(1)}M
                    </strong>
                    <small>{quickplayStats.climbSpeed.toFixed(2)}M/S</small>
                  </div>
                  <div>
                    <span>FLOOR</span>
                    <strong
                      className="game-stat-pop"
                      key={`floor-${quickplayStats.floor}`}
                    >
                      {quickplayStats.floor}
                    </strong>
                  </div>
                </>
              ) : null}
              <div>
                <span>PIECES</span>
                <strong
                  className="game-stat-pop"
                  key={`pieces-${targetState.piecesPlaced}`}
                >
                  {targetState.piecesPlaced}
                </strong>
                <small>
                  {targetState.update.piecesPerSecond.toFixed(2)}/S
                </small>
              </div>
              <div>
                <span>LINES</span>
                <strong
                  className="game-stat-pop"
                  key={`lines-${targetState.lines}`}
                >
                  {targetState.lines}
                </strong>
              </div>
              {!quickplayStats ? (
                <div>
                  <span>SCORE</span>
                  <strong
                    className="game-stat-pop"
                    key={`score-${targetState.score}`}
                  >
                    {targetState.score}
                  </strong>
                </div>
              ) : null}
            </div>
          </div>

          <div className="room-game__main-board">
            <div className="room-game__board-stack">
              <GameGarbageQueue
                alwaysVisible
                cellSize={mainCellSize}
                queue={targetState.garbageQueue}
                rows={targetState.rows}
              />
              <GameBoard
                cellSize={mainCellSize}
                gameState={targetState}
                showGhost={gameConfig.controls.showShadowPiece}
              />
            </div>
            <div className="versus-game__name">
              {formatPlayerName(
                targetPlayer?.username ??
                  selfPlayer?.username ??
                  session.currentUser?.username,
                isSpectating ? "SPECTATING" : "YOU",
              )}
            </div>
            <StockCrystals
              stockLeft={targetPlayer?.stockLeft}
              stockTotal={targetPlayer?.stockTotal}
            />
            {isQuickplay && (
              <div className="room-game__meters">
                <strong>{targetMeters.toLocaleString()}m</strong>
                <span>{quickplayFloor.name}</span>
                {targetPlayer?.altitudeBonusMeters ? (
                  <small>+{targetPlayer.altitudeBonusMeters.toFixed(1)}</small>
                ) : null}
              </div>
            )}
          </div>

          <div className="room-game__right-rail">
            <GamePreviewPanel
              className="solo-game__panel room-game__next"
              figureSize={previewFigureSize}
              nextCount={targetConfig.controls.nextPieces}
              state={targetState}
              type="next"
            />
          </div>
        </div>

        <aside
          className={`room-game__opponents room-game__opponents--${Math.min(
            previewPlayers.length,
            6,
          )}${isQuickplay ? " room-game__opponents--quickplay" : ""}`}
          aria-label={isQuickplay ? "Quickplay standings" : "Opponents"}
        >
          {isQuickplay ? (
            quickplayPlayers.map((player, index) => {
              const meters = getQuickplayMeters(player);

              return (
                <button
                  className="room-game__quick-card"
                  key={player.id}
                  onClick={() => setSelectedTargetId(String(player.id))}
                  type="button"
                >
                  <span>{index + 1}</span>
                  <strong>{formatPlayerName(player.username, "PLAYER")}</strong>
                  <em>{meters.toLocaleString()}m</em>
                </button>
              );
            })
          ) : (
          <>
          {previewPlayers.length > 0 ? (
            previewPlayers.map((player) => (
              <button
                className="room-game__opponent"
                disabled={!isSpectating}
                key={player.id}
                onClick={() => setSelectedTargetId(String(player.id))}
                type="button"
              >
                <div className="room-game__opponent-package">
                  {(player.config?.controls.hold ??
                    gameConfig.controls.hold) ? (
                    <GamePreviewPanel
                      className="solo-game__panel room-game__opponent-hold"
                      figureSize={Math.max(9, opponentCellSize - 2)}
                      state={player.state}
                      type="hold"
                    />
                  ) : (
                    <div />
                  )}
                  <div className="room-game__opponent-board-stack">
                    <GameGarbageQueue
                      alwaysVisible
                      cellSize={opponentCellSize}
                      queue={player.state.garbageQueue}
                      rows={player.state.rows}
                    />
                    <GameBoard
                      cellSize={opponentCellSize}
                      gameState={player.state}
                      showGhost={false}
                    />
                  </div>
                  <GamePreviewPanel
                    className="solo-game__panel room-game__opponent-next"
                    figureSize={Math.max(9, opponentCellSize - 2)}
                    nextCount={Math.min(
                      3,
                      player.config?.controls.nextPieces ??
                        gameConfig.controls.nextPieces,
                    )}
                    state={player.state}
                    type="next"
                  />
                  {isSpectating && (
                    <span className="room-game__watch">WATCH</span>
                  )}
                </div>
                <div className="room-game__opponent-name">
                  {formatPlayerName(player.username, "PLAYER")}
                </div>
                <div className="room-game__opponent-stats">
                  <span>{player.state.lines} L</span>
                  <span>{player.state.score} PTS</span>
                </div>
              </button>
            ))
          ) : (
            <div className="room-game__waiting">
              {alivePlayers.length === 0
                ? "WAITING FOR ROUND RESULT"
                : "LAST PLAYER STANDING"}
            </div>
          )}
          </>
          )}
        </aside>
      </section>

      <GameAbortOverlay progress={session.escProgress} />
      <GameFocusOverlay
        active={!isSpectating && !session.focused && !session.result}
      />
    </main>
  );
}
