import { useState } from "react";
import type { GameStats } from "./types";

type QuickGameOverProps = {
  chatMessages: Array<{
    id: string;
    author: string;
    actor?: string;
    floor?: number;
    floorName?: string;
    isPersonalBest?: boolean;
    meters?: number;
    system?: boolean;
    text: string;
    variant?: string;
  }>;
  climbers: Array<{
    id: string | number;
    username?: string;
    quickplayMeters?: number;
  }>;
  onAgain: () => void;
  onChatMessage: (message: string) => void;
  onExit: () => void;
  onSendToChat: () => void;
  onSpectate: () => void;
  quickplay?: {
    meters: number;
    floor: number;
    floorName?: string;
    previousBestMeters: number | null;
    isPersonalBest: boolean;
  };
  stats: GameStats;
};

export default function QuickGameOver({
  chatMessages,
  climbers,
  onAgain,
  onChatMessage,
  onExit,
  onSendToChat,
  onSpectate,
  quickplay,
  stats,
}: QuickGameOverProps) {
  const [chatMessage, setChatMessage] = useState("");
  const altitude = quickplay?.meters ?? stats.lines + stats.piecesPlaced / 100;
  const previousBest = quickplay?.previousBestMeters;

  return (
    <main className="solo-game quick-results">
      <header className="quick-game__topbar">
        <h1>QUICK PLAY</h1>
        <button className="quick-results__exit" onClick={onExit} type="button">
          EXIT
        </button>
      </header>

      <aside className="quick-results__chat" aria-label="Quick Play chat">
        <div className="quick-results__chat-log">
          <p>
            <strong>[SYS]</strong>: Welcome to Quick Play chat! Please remember to be civil.
          </p>
          {chatMessages.map((message) => (
            message.variant === "quickplay-result" ? (
              <p
                className={`quick-chat-result quick-chat-result--floor-${message.floor ?? 1}`}
                key={message.id}
              >
                <strong>{message.author}</strong>
                <span>{message.meters?.toFixed(1) ?? message.text}M</span>
                <em>
                  {message.floorName ?? `Floor ${message.floor ?? 1}`}
                  {message.isPersonalBest ? " / new PB" : ""}
                </em>
              </p>
            ) : (
              <p key={message.id}>
                <strong>[{message.author}]</strong>:{" "}
                {message.system && message.actor ? (
                  <>
                    <strong>{message.actor}</strong>: {message.text}
                  </>
                ) : (
                  message.text
                )}
              </p>
            )
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onChatMessage(chatMessage);
            setChatMessage("");
          }}
        >
          <input
            onChange={(event) => setChatMessage(event.target.value)}
            placeholder="message..."
            value={chatMessage}
          />
        </form>
      </aside>

      <section className="quick-results__center">
        <section className="quick-results__panel" aria-label="Quick Play results">
          <div className="quick-results__spectate">QUICK PLAY</div>
          <div className="quick-results__kicker">YOUR FINAL ALTITUDE</div>
          <div className="quick-results__altitude-box">
            <strong className="quick-results__altitude">
              {altitude.toFixed(1)}M
            </strong>
          </div>
          <div className="quick-results__best">
            {quickplay?.isPersonalBest ? (
              <strong>NEW PERSONAL BEST</strong>
            ) : previousBest !== null && previousBest !== undefined ? (
              <span>PERSONAL BEST {previousBest.toFixed(1)}M</span>
            ) : (
              <span>NO SAVED PERSONAL BEST</span>
            )}
          </div>
        </section>

        <div className="quick-results__share">
          <button onClick={onSendToChat} type="button">
            SEND TO CHAT
          </button>
        </div>

        <button className="quick-results__again" onClick={onAgain} type="button">
          AGAIN
        </button>

        <section className="quick-results__stats" aria-label="Run stats">
          <h2>STATS</h2>
          <div>
            <span>FLOOR</span>
            <strong>{quickplay?.floorName ?? quickplay?.floor ?? 1}</strong>
          </div>
          <div>
            <span>PIECES</span>
            <strong>{stats.piecesPlaced}</strong>
          </div>
          <div>
            <span>LINES</span>
            <strong>{stats.lines}</strong>
          </div>
          <div>
            <span>SCORE</span>
            <strong>{stats.score}</strong>
          </div>
        </section>
      </section>

      <aside className="quick-results__standings" aria-label="Quick Play standings">
        <strong>{climbers.length} PLAYING NOW</strong>
        {climbers.length > 0 ? (
          <div className="quick-results__players">
            {climbers.map((player, index) => (
              <button key={player.id} onClick={onSpectate} type="button">
                <span>{index + 1}</span>
                <strong>{player.username ?? "PLAYER"}</strong>
                <em>{(player.quickplayMeters ?? 0).toFixed(1)}m</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="quick-results__empty">NO ACTIVE CLIMBERS</div>
        )}
      </aside>
    </main>
  );
}
