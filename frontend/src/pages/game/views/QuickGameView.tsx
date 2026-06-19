import { useEffect, useState, type CSSProperties } from "react";
import GameBoard from "../../../components/GameBoard/GameBoard";
import { formatPlayerName, formatRunTime } from "../gameUtils";
import type { GameSession } from "../hooks/useGameSession";
import GameAbortOverlay from "../components/GameAbortOverlay";
import GameFocusOverlay from "../components/GameFocusOverlay";
import GameGarbageQueue from "../components/GameGarbageQueue";
import GamePreviewPanel from "../components/GamePreviewPanel";

type QuickGameViewProps = {
  session: GameSession;
};

const TABLET_BREAKPOINT_PX = 860;
const QUICK_PACKAGE_SCALE_FLOOR = 0.82;
const QUICK_BASE_WIDTH_PX = 58 * 16;
const QUICK_BASE_HEIGHT_PX = 50 * 16;

function getQuickPackageScale() {
  if (window.innerWidth <= TABLET_BREAKPOINT_PX) {
    return QUICK_PACKAGE_SCALE_FLOOR;
  }

  const widthScale = (window.innerWidth - 64) / QUICK_BASE_WIDTH_PX;
  const heightScale = (window.innerHeight - 72) / QUICK_BASE_HEIGHT_PX;
  return Math.min(
    1,
    Math.max(QUICK_PACKAGE_SCALE_FLOOR, Math.min(widthScale, heightScale)),
  );
}

export default function QuickGameView({ session }: QuickGameViewProps) {
  const { gameConfig, gameState, selfPlayer } = session;
  const [packageScale, setPackageScale] = useState(getQuickPackageScale);

  useEffect(() => {
    const updateScale = () => setPackageScale(getQuickPackageScale());

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (!gameState || gameConfig?.mode !== "quickplay") return null;

  const stats = gameState.update;
  const quickplayStats = stats.quickplay ?? gameState.quickplay;
  const cellSize = Math.round(34 * packageScale);
  const previewFigureSize = Math.round(30 * packageScale);
  const playerName = formatPlayerName(
    selfPlayer?.username ?? session.currentUser?.username,
    "GUEST",
  );
  const style = {
    "--quick-package-scale": String(packageScale),
  } as CSSProperties;

  return (
    <main className="solo-game quick-game" style={style}>
      <header className="quick-game__topbar">
        <h1>QUICK PLAY</h1>
        <div className="quick-game__identity">
          <strong>{playerName}</strong>
          <span>{session.connectionStatus}</span>
        </div>
      </header>

      <section className="quick-game__stage" aria-label="Quick Play run">
        <div className="quick-game__cabinet">
          <div className="quick-game__left">
            {gameConfig.controls.hold ? (
              <GamePreviewPanel
                className="solo-game__panel quick-game__hold"
                figureSize={previewFigureSize}
                state={gameState}
                type="hold"
              />
            ) : (
              <div className="quick-game__hold-spacer" />
            )}

            <aside className="quick-game__stats" aria-label="Quick Play stats">
              <div>
                <span>TRILINE</span>
                <strong>{quickplayStats?.meters.toFixed(1) ?? "0.0"}M</strong>
              </div>
              <div>
                <span>FLOOR</span>
                <strong>{quickplayStats?.floor ?? 1}</strong>
                <small>HALL OF BEGINNINGS</small>
              </div>
              <div>
                <span>KO'S</span>
                <strong>0</strong>
              </div>
              <div>
                <span>PIECES</span>
                <strong>{gameState.piecesPlaced}</strong>
                <small>{stats.piecesPerSecond.toFixed(2)}/S</small>
              </div>
              <div>
                <span>ATTACK</span>
                <strong>{gameState.lines}</strong>
              </div>
              <div>
                <span>TIME</span>
                <strong>{formatRunTime(stats.elapsedMs)}</strong>
              </div>
            </aside>
          </div>

          <div className="quick-game__board-wrap">
            <div className="quick-game__board-stack">
              <GameGarbageQueue
                alwaysVisible
                cellSize={cellSize}
                queue={gameState.garbageQueue}
                rows={gameState.rows}
              />
              <div className="quick-game__board-shell">
                <GameBoard
                  cellSize={cellSize}
                  gameState={gameState}
                  showGhost={gameConfig.controls.showShadowPiece}
                />
                <div className="quick-game__floor-card">
                  <span>FLOOR</span>
                  <strong>{quickplayStats?.floor ?? 1}</strong>
                  <small>HALL OF BEGINNINGS</small>
                </div>
              </div>
            </div>
            <div className="quick-game__name">{playerName}</div>
            <div className="quick-game__altitude">
              {quickplayStats?.meters.toFixed(1) ?? "0.0"}
            </div>
          </div>

          <div className="quick-game__right">
            <GamePreviewPanel
              className="solo-game__panel quick-game__next"
              figureSize={previewFigureSize}
              nextCount={gameConfig.controls.nextPieces}
              state={gameState}
              type="next"
            />
          </div>
        </div>
      </section>

      <GameAbortOverlay progress={session.escProgress} />
      <GameFocusOverlay active={!session.focused && !session.result} />
    </main>
  );
}
