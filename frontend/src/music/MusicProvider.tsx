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
  sfxVolume: number;
};

type MusicContextValue = AudioSettings & {
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
      sfxVolume:
        typeof stored.sfxVolume === "number"
          ? clampVolume(stored.sfxVolume)
          : 0.7,
    };
  } catch {
    return { bgmVolume: 0.35, sfxVolume: 0.7 };
  }
}

export function MusicProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readSettings);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || settings.bgmVolume === 0 || !audio.paused) return;
    void audio.play().catch(() => {
      // Browsers may block autoplay until the first user interaction.
    });
  }, [settings.bgmVolume]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.style.setProperty(
      "--sfx-volume",
      String(settings.sfxVolume),
    );
  }, [settings]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.volume = settings.bgmVolume;
    if (settings.bgmVolume === 0) {
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
  }, [settings.bgmVolume, startMusic]);

  const value = useMemo<MusicContextValue>(
    () => ({
      ...settings,
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
        autoPlay
        loop
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
