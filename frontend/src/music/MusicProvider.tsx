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
  setTrack: (src: string | null) => void;
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
  const [trackSrc, setTrackSrc] = useState<string>(DEFAULT_TRACK);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef(DEFAULT_TRACK);
  const fadeTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(
    null,
  );
  const isFadingRef = useRef(false);
  const effectiveBgmVolume = settings.muted ? 0 : settings.bgmVolume;
  const effectiveSfxVolume = settings.muted ? 0 : settings.sfxVolume;

  const clearFade = useCallback(() => {
    if (!fadeTimerRef.current) return;
    window.clearInterval(fadeTimerRef.current);
    fadeTimerRef.current = null;
  }, []);

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
    if (!isFadingRef.current) {
      audio.volume = effectiveBgmVolume;
    }
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || currentTrackRef.current === trackSrc) return undefined;

    clearFade();

    if (effectiveBgmVolume === 0 || settings.muted) {
      audio.src = trackSrc;
      audio.load();
      currentTrackRef.current = trackSrc;
      return undefined;
    }

    isFadingRef.current = true;

    const fadeOutSteps = 12;
    const fadeInSteps = 18;
    const fadeOutStartVolume = audio.volume;
    let step = 0;

    fadeTimerRef.current = window.setInterval(() => {
      step += 1;
      audio.volume = Math.max(
        0,
        fadeOutStartVolume * (1 - step / fadeOutSteps),
      );

      if (step < fadeOutSteps) return;

      clearFade();
      audio.src = trackSrc;
      audio.load();
      audio.volume = 0;
      currentTrackRef.current = trackSrc;
      void audio.play().catch(() => {
        // The usual browser autoplay rule can still apply after a track swap.
      });

      let fadeInStep = 0;
      fadeTimerRef.current = window.setInterval(() => {
        fadeInStep += 1;
        audio.volume = Math.min(
          effectiveBgmVolume,
          effectiveBgmVolume * (fadeInStep / fadeInSteps),
        );

        if (fadeInStep < fadeInSteps) return;

        clearFade();
        isFadingRef.current = false;
        audio.volume = effectiveBgmVolume;
      }, 32);
    }, 28);

    return () => {
      clearFade();
      isFadingRef.current = false;
    };
  }, [clearFade, effectiveBgmVolume, settings.muted, trackSrc]);

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
      setTrack: (src) => setTrackSrc(src ?? DEFAULT_TRACK),
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
        src={trackSrc}
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
