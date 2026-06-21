import { useEffect, useState, type CSSProperties } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import { formatPlayerName, getModeLabel } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GameFocusOverlay from "../components/GameFocusOverlay";
import GameGarbageQueue from "../components/GameGarbageQueue";
import GamePreviewPanel from "../components/GamePreviewPanel";
import { useMusic } from "../../../music/MusicProvider";

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
  {
    name: "HALL OF BEGINNINGS",
    min: 0,
    max: 50,
    className: "floor-1",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/1floro_hall_of_befinnings.png",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/01_hall_of_the_beginners_v2.mp3",
  },
  {
    name: "THE HOTEL",
    min: 50,
    max: 150,
    className: "floor-2",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/2floor_hotel.png",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/02_the_hotel_v2.mp3",
  },
  {
    name: "THE CASINO",
    min: 150,
    max: 300,
    className: "floor-3",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/3floor_casino.png",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/03_casino_v2.mp3",
  },
  {
    name: "THE ARENA",
    min: 300,
    max: 450,
    className: "floor-4",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/4floor_arena.png",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/04_arena_v2.mp3",
  },
  {
    name: "THE MUSEUM",
    min: 450,
    max: 650,
    className: "floor-5",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/5floor_museum.png",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/05_museum_v2.mp3",
  },
  {
    name: "PLATFORM OF THE GODS",
    min: 650,
    max: Number.POSITIVE_INFINITY,
    className: "floor-6",
    background: "/quickplay/floor-backgrounds/tetris_floor_backgrounds_pack/6floor_platform_of_the_gods_space_blinking.gif",
    soundtrack: "/quickplay/floor-soundtracks/tetris_floor_soundtracks_pack/06_platform_of_the_gods_v2.mp3",
  },
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

function getQuickplayFloorProgress(meters: number, floor: typeof QUICKPLAY_FLOORS[number]) {
  if (!Number.isFinite(floor.max)) {
    return ((Math.max(0, meters - floor.min) % 100) / 100);
  }

  return Math.max(0, Math.min(1, (meters - floor.min) / (floor.max - floor.min)));
}

function getQuickplayNextFloor(floor: typeof QUICKPLAY_FLOORS[number]) {
  const index = QUICKPLAY_FLOORS.indexOf(floor);
  return QUICKPLAY_FLOORS[Math.min(index + 1, QUICKPLAY_FLOORS.length - 1)];
}

function formatElapsedTime(elapsedMs?: number) {
  const totalSeconds = Math.max(0, Math.floor((elapsedMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const { setTrack } = useMusic();
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

  const selectedTrackTarget = alivePlayers.find(
    (player) => String(player.id) === selectedTargetId,
  );
  const activeQuickplayFloor = getQuickplayFloor(
    gameConfig?.mode === "quickplay"
      ? getQuickplayMeters(
          (isSpectating ? selectedTrackTarget ?? alivePlayers[0] : selfPlayer) ??
            alivePlayers[0] ??
            {},
        )
      : 0,
  );

  useEffect(() => {
    if (gameConfig?.mode !== "quickplay" || !gameState) return undefined;

    setTrack(activeQuickplayFloor.soundtrack);
    return () => setTrack(null);
  }, [activeQuickplayFloor.soundtrack, gameConfig?.mode, gameState, setTrack]);

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
  const maxMainCellByHeight = Math.floor(
    (window.innerHeight - 155) / (targetState.rows ?? 20),
  );
  const mainCellSize = Math.max(
    8,
    Math.min(Math.round(32 * packageScale), maxMainCellByHeight),
  );
  const previewFigureSize = Math.max(8, Math.round(mainCellSize * 0.94));
  const isQuickplay = gameConfig.mode === "quickplay";
  const targetMeters = targetPlayer ? getQuickplayMeters(targetPlayer) : 0;
  const quickplayFloor = getQuickplayFloor(targetMeters);
  const quickplayFloorProgress = getQuickplayFloorProgress(
    targetMeters,
    quickplayFloor,
  );
  const quickplayNextFloor = getQuickplayNextFloor(quickplayFloor);
  const quickplayBlend =
    quickplayFloor === quickplayNextFloor
      ? 0
      : quickplayFloorProgress > 0.86
        ? Math.min(1, (quickplayFloorProgress - 0.86) / 0.14)
        : quickplayFloorProgress < 0.08
          ? Math.max(0, 1 - quickplayFloorProgress / 0.08) * 0.28
          : 0;
  const quickplayPlayers = [...alivePlayers]
    .sort((a, b) => getQuickplayMeters(b) - getQuickplayMeters(a));
  const style = {
    "--room-package-scale": String(packageScale),
    "--quickplay-bg-image": `url("${quickplayFloor.background}")`,
    "--quickplay-bg-next-image": `url("${quickplayNextFloor.background}")`,
    "--quickplay-bg-position-y": `${Math.round(quickplayFloorProgress * 100)}%`,
    "--quickplay-bg-shift-y": `${(quickplayFloorProgress * -18).toFixed(2)}vh`,
    "--quickplay-bg-blend-opacity": quickplayBlend.toFixed(3),
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
        {(gameConfig.mode === "custom" || gameConfig.mode === "quickplay") &&
          isSpectating && (
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
                    <span>TIME</span>
                    <strong
                      className="game-stat-pop"
                      key={`time-${Math.floor((targetState.update.elapsedMs ?? 0) / 1000)}`}
                    >
                      {formatElapsedTime(targetState.update.elapsedMs)}
                    </strong>
                  </div>
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
            {targetConfig.controls.nextPieces > 0 && (
              <GamePreviewPanel
                className="solo-game__panel room-game__next"
                figureSize={previewFigureSize}
                nextCount={targetConfig.controls.nextPieces}
                state={targetState}
                type="next"
              />
            )}
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
            <>
              {session.quickplayKos.map((player) => (
                <div
                  className="room-game__quick-card room-game__quick-card--ko"
                  key={`ko-${player.id}`}
                >
                  <span>KO</span>
                  <strong>{formatPlayerName(player.username, "PLAYER")}</strong>
                  <em>{(player.meters ?? 0).toLocaleString()}m</em>
                </div>
              ))}
              {quickplayPlayers.map((player, index) => {
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
              })}
            </>
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
                  {(player.config?.controls.nextPieces ??
                    gameConfig.controls.nextPieces) > 0 ? (
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
                  ) : (
                    <div />
                  )}
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
