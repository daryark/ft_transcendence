import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../../../socket/socketClient";
import { useToast } from "../../../components/Toast/ToastProvider";
import "./MultiplayerMode.scss";

const quickMods = [
  {
    id: "double-hole",
    label: "II",
    name: "DOUBLE HOLE",
    image: "/cards/Doublehole.png",
    description: "Garbage has two wells.",
  },
  {
    id: "no-hold",
    label: "H",
    name: "NO HOLD",
    image: "/cards/Nohold.png",
    description: "Hold queue is disabled.",
  },
  {
    id: "messier-garbage",
    label: "M",
    name: "MESSIER GARBAGE",
    image: "/cards/Messy.png",
    description: "Garbage is significantly messier.",
  },
  {
    id: "faster-gravity",
    label: "G",
    name: "FASTER GRAVITY",
    image: "/cards/Gravity.png",
    description: "The stack gets heavier faster.",
  },
] as const;

type QuickChatMessage = {
  id: string;
  author: string;
  actor?: string;
  system?: boolean;
  text: string;
};

function normalizeQuickChatMessage(
  message: {
    actor?: string;
    id?: string;
    message?: string;
    sender?: string;
    system?: boolean;
    text?: string;
  },
  index: number,
): QuickChatMessage {
  return {
    id: message.id ?? `${Date.now()}-${index}`,
    author: message.sender ?? "PLAYER",
    actor: message.actor,
    system: message.system,
    text: message.text ?? message.message ?? "",
  };
}

export default function Quick() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<QuickChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [waitingStatus, setWaitingStatus] = useState("");
  const waitingToastShownRef = useRef("");

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleRoomUpdate = (snapshot: {
      roomId?: string;
      players?: number;
      waitingFor?: number;
      chatMessages?: Array<Parameters<typeof normalizeQuickChatMessage>[0]>;
    }) => {
      if (!snapshot.waitingFor) return;

      setWaitingStatus(
        `Need ${snapshot.waitingFor} players. Waiting for pool to start.`,
      );
      setChatMessages(
        (snapshot.chatMessages ?? []).map((message, index) =>
          normalizeQuickChatMessage(message, index),
        ),
      );

      if (waitingToastShownRef.current !== snapshot.roomId) {
        waitingToastShownRef.current = snapshot.roomId ?? "quickplay";
        showToast("Need two players. Waiting for pool to start.", "info");
      }
    };

    const handleChatMessage = (data: Parameters<typeof normalizeQuickChatMessage>[0]) => {
      setChatMessages((current) => [
        ...current,
        normalizeQuickChatMessage(data, current.length),
      ]);
    };

    socket.on("room:update", handleRoomUpdate);
    socket.on("chat:message", handleChatMessage);

    return () => {
      socket.off("room:update", handleRoomUpdate);
      socket.off("chat:message", handleChatMessage);
    };
  }, [showToast]);

  const toggleMod = (modifier: string) => {
    setSelectedMods((current) =>
      current.includes(modifier)
        ? current.filter((item) => item !== modifier)
        : [...current, modifier],
    );
  };

  const startQuickplay = () => {
    const socket = getSocket();
    if (!socket) return;

    const handleGameStart = (payload: { roomId?: string }) => {
      if (!payload.roomId) return;

      socket.off("game:start", handleGameStart);
      navigate(`/game/${payload.roomId}`, {
        state: {
          ...payload,
          from: "/play/multiplayer/quick",
        },
      });
    };

    socket.once("game:start", handleGameStart);
    socket.emit("mode:join", {
      mode: "quickplay",
      payload: {
        gameConfig: {
          mode: "quickplay",
          modifiers: selectedMods,
        },
      },
    });
  };

  const sendChatMessage = () => {
    const message = chatMessage.trim();
    if (!message) return;

    getSocket()?.emit("chat:message", { message });
    setChatMessage("");
  };

  return (
    <section className="mp-page mp-page--quick">
      <header className="mp-quick-header">
        <h1>QUICK PLAY</h1>
      </header>

      <button
        className="mp-back"
        type="button"
        onClick={() => navigate("/play/multiplayer")}
      >
        EXIT
      </button>

      <main className="mp-quick-lobby" aria-label="Quick Play">
        <aside className="mp-quick-feed" aria-label="Quick Play feed">
          <div className="mp-quick-chat" aria-label="Quick Play chat">
            <div className="mp-quick-chat-log">
              <p>
                <strong>[SYS]</strong>: Welcome to Quick Play chat! Please remember to be civil.
              </p>
              <p>
                <strong>[SYS]</strong>: This chat is linked with the active tower.
              </p>
              {chatMessages.map((message) => (
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
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendChatMessage();
              }}
            >
              <input
                onChange={(event) => setChatMessage(event.target.value)}
                placeholder="message..."
                value={chatMessage}
              />
            </form>
          </div>
          <div className="mp-quick-mini-list" aria-label="Recent climbers">
            <span>{waitingStatus || "WAITING FOR CLIMBERS"}</span>
          </div>
        </aside>

        <section className="mp-quick-center">
          <article className="mp-card mp-quick-intro">
            <span className="mp-card__kicker">SPECTATE</span>
            <h2>QUICK PLAY</h2>
            <p>
              Welcome to the Zenith Tower! Send lines and KO enemies to scale
              the tower. The further up the tower, the stronger the opponents.
            </p>
            <p>Leaderboards reset every week. How far can you get?</p>
            <div className="mp-best">
              This week's personal best
              <strong>0.0 M</strong>
            </div>
          </article>

          <button className="mp-start mp-quick-start" onClick={startQuickplay} type="button">
            START
          </button>

          <div className="mp-mods" aria-label="Quick Play modifiers">
            <div className="mp-mod-stack">
              {quickMods.map((mod, index) => (
                <button
                  className={`mp-mod-card mp-mod-card--${index + 1}${
                    selectedMods.includes(mod.id) ? " is-selected" : ""
                  }`}
                  key={mod.id}
                  onClick={() => toggleMod(mod.id)}
                  title={mod.name}
                  type="button"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="mp-mod-card__image"
                    loading="lazy"
                    src={mod.image}
                  />
                  <span className="mp-mod-card__badge">{mod.label}</span>
                  <span className="mp-mod-card__name">{mod.name}</span>
                  <span className="mp-mod-card__desc">{mod.description}</span>
                </button>
              ))}
            </div>
            <div className="mp-mod-footer">
              <strong>{selectedMods.length ? selectedMods.length : 0}</strong>
              <span>MODIFIERS SELECTED</span>
            </div>
          </div>
        </section>

        <aside className="mp-quick-standings" aria-label="Quick Play standings">
          <strong>0 PLAYING NOW</strong>
          <div className="mp-quick-empty">NO ACTIVE CLIMBERS</div>
        </aside>
      </main>

    </section>
  );
}
