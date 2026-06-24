import { useCallback, useEffect, useRef, useState } from "react";
import { useMusic } from "./MusicProvider";
import "./GameAudioPanel.scss";

const FADE_DELAY_MS = 1800;
const WHEEL_STEP = 0.05;

type VolumeControlProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onInteract: () => void;
};

function VolumeControl({
  label,
  value,
  onChange,
  onInteract,
}: VolumeControlProps) {
  const adjust = (direction: number) => {
    onChange(Math.max(0, Math.min(1, value + direction * WHEEL_STEP)));
    onInteract();
  };

  return (
    <div
      aria-label={`${label} volume ${Math.round(value * 100)} percent`}
      aria-orientation="vertical"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value * 100)}
      className="game-audio-panel__control"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        adjust(event.deltaY < 0 ? 1 : -1);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          adjust(1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          adjust(-1);
        }
      }}
      role="slider"
      tabIndex={0}
    >
      <span className="game-audio-panel__label">{label}</span>
      <span className="game-audio-panel__track">
        <span
          className="game-audio-panel__fill"
          style={{ height: `${value * 100}%` }}
        />
      </span>
    </div>
  );
}

export default function GameAudioPanel() {
  const {
    bgmVolume,
    muted,
    setBgmVolume,
    setMuted,
    setSfxVolume,
    sfxVolume,
  } = useMusic();
  const [visible, setVisible] = useState(false);
  const fadeTimer = useRef<number | null>(null);
  const volumesRef = useRef({ bgmVolume, sfxVolume });

  useEffect(() => {
    volumesRef.current = { bgmVolume, sfxVolume };
  }, [bgmVolume, sfxVolume]);

  const reveal = useCallback(() => {
    setVisible(true);
    if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(
      () => setVisible(false),
      FADE_DELAY_MS,
    );
  }, []);

  useEffect(() => {
    const handleGlobalWheel = (event: WheelEvent) => {
      const direction = event.deltaY < 0 ? 1 : -1;
      const volumes = volumesRef.current;
      setMuted(false);
      setBgmVolume(volumes.bgmVolume + direction * WHEEL_STEP);
      setSfxVolume(volumes.sfxVolume + direction * WHEEL_STEP);
      reveal();
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      if (fadeTimer.current !== null) window.clearTimeout(fadeTimer.current);
    };
  }, [reveal, setBgmVolume, setMuted, setSfxVolume]);

  return (
    <aside
      aria-label="Game audio controls"
      className={`game-audio-panel${visible ? " is-visible" : ""}`}
      onFocus={reveal}
    >
      <button
        aria-pressed={muted}
        className="game-audio-panel__mute"
        onClick={() => {
          setMuted(!muted);
          reveal();
        }}
        type="button"
      >
        {muted ? "SOUND OFF" : "SOUND ON"}
      </button>
      <VolumeControl
        label="SFX"
        onChange={(value) => {
          setMuted(false);
          setSfxVolume(value);
        }}
        onInteract={reveal}
        value={muted ? 0 : sfxVolume}
      />
      <VolumeControl
        label="BGM"
        onChange={(value) => {
          setMuted(false);
          setBgmVolume(value);
        }}
        onInteract={reveal}
        value={muted ? 0 : bgmVolume}
      />
    </aside>
  );
}
