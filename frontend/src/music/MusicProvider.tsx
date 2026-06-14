import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_TRACK = "/music/4-1.mp3";
const SETTINGS_KEY = "tetra-audio-settings";
const LEGACY_SETTINGS_KEY = "tetra-music-settings";

type AudioSettings = {
  bgmVolume: number;
  muted: boolean;
  sfxVolume: number;
};

type MusicContextValue = AudioSettings & {
  setMuted: (muted: boolean) => void;
  setBgmVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

const clampVolume = (volume: number) => Math.max(0, Math.min(1, volume));

function readSettings(): AudioSettings {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(SETTINGS_KEY) ?? "{}",
    ) as Partial<AudioSettings>;
    const legacy = JSON.parse(
      window.localStorage.getItem(LEGACY_SETTINGS_KEY) ?? "{}",
    ) as { volume?: number };

    return {
      bgmVolume:
        typeof stored.bgmVolume === "number"
          ? clampVolume(stored.bgmVolume)
          : typeof legacy.volume === "number"
            ? clampVolume(legacy.volume)
            : 0.35,
      muted: Boolean(stored.muted),
      sfxVolume:
        typeof stored.sfxVolume === "number"
          ? clampVolume(stored.sfxVolume)
          : 0.7,
    };
  } catch {
    return { bgmVolume: 0.35, muted: false, sfxVolume: 0.7 };
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readSettings);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const effectiveBgmVolume = settings.muted ? 0 : settings.bgmVolume;
  const effectiveSfxVolume = settings.muted ? 0 : settings.sfxVolume;

  const startMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || effectiveBgmVolume === 0 || !audio.paused) return;
    void audio.play().catch(() => {
      // Browsers may block autoplay until the first user interaction.
    });
  }, [effectiveBgmVolume]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.style.setProperty(
      "--sfx-volume",
      String(effectiveSfxVolume),
    );
  }, [effectiveSfxVolume, settings]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.muted = settings.muted || effectiveBgmVolume === 0;
    audio.volume = effectiveBgmVolume;
    if (effectiveBgmVolume === 0) {
      audio.pause();
    } else {
      startMusic();
    }

    const unlockAudio = () => startMusic();
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [effectiveBgmVolume, settings.muted, startMusic]);

  const value = useMemo<MusicContextValue>(
    () => ({
      ...settings,
      bgmVolume: settings.bgmVolume,
      sfxVolume: settings.sfxVolume,
      setMuted: (muted) =>
        setSettings((current) => ({
          ...current,
          muted,
        })),
      setBgmVolume: (bgmVolume) =>
        setSettings((current) => ({
          ...current,
          bgmVolume: clampVolume(bgmVolume),
        })),
      setSfxVolume: (sfxVolume) =>
        setSettings((current) => ({
          ...current,
          sfxVolume: clampVolume(sfxVolume),
        })),
    }),
    [settings],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
      <audio
        loop
        muted={settings.muted || effectiveBgmVolume === 0}
        preload="auto"
        ref={audioRef}
        src={DEFAULT_TRACK}
      />
    </MusicContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used inside MusicProvider");
  return context;
}
