import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getSocket,
  subscribeToSocket,
} from "../socket/socketClient";
import "./BackgroundProvider.scss";

// Add future files from public/background here to include them in the cycle.
const BACKGROUND_IMAGES = [
  "/background/forest_fog.jpg",
  "/background/mountain.jpg",
  "/background/mountain_snow.jpg",
] as const;

const STORAGE_KEY = "tetra-background-index";
const CROSSFADE_MS = 1400;

function readStoredIndex() {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isInteger(stored) &&
    stored >= 0 &&
    stored < BACKGROUND_IMAGES.length
    ? stored
    : 0;
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => resolve();
    image.onload = finish;
    image.onerror = finish;
    image.src = src;

    if (image.complete) resolve();
  });
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [currentIndex, setCurrentIndex] = useState(readStoredIndex);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const currentIndexRef = useRef(currentIndex);
  const transitionTimer = useRef<number | null>(null);
  const transitionSequence = useRef(0);

  const advanceBackground = useCallback(async () => {
    const sequence = ++transitionSequence.current;
    const previousIndex = currentIndexRef.current;
    const nextIndex = (previousIndex + 1) % BACKGROUND_IMAGES.length;

    await preloadImage(BACKGROUND_IMAGES[nextIndex]);
    if (sequence !== transitionSequence.current) return;

    if (transitionTimer.current !== null) {
      window.clearTimeout(transitionTimer.current);
    }

    currentIndexRef.current = nextIndex;
    setOutgoingIndex(previousIndex);
    setCurrentIndex(nextIndex);
    window.localStorage.setItem(STORAGE_KEY, String(nextIndex));

    transitionTimer.current = window.setTimeout(() => {
      setOutgoingIndex(null);
      transitionTimer.current = null;
    }, CROSSFADE_MS);
  }, []);

  useEffect(() => {
    let activeSocket = getSocket();

    const attach = () => {
      const nextSocket = getSocket();
      if (nextSocket === activeSocket) return;

      activeSocket?.off("game:start", advanceBackground);
      activeSocket = nextSocket;
      activeSocket?.on("game:start", advanceBackground);
    };

    activeSocket?.on("game:start", advanceBackground);
    const unsubscribe = subscribeToSocket(attach);

    return () => {
      unsubscribe();
      activeSocket?.off("game:start", advanceBackground);
      if (transitionTimer.current !== null) {
        window.clearTimeout(transitionTimer.current);
      }
    };
  }, [advanceBackground]);

  useEffect(() => {
    const nextIndex = (currentIndex + 1) % BACKGROUND_IMAGES.length;
    void preloadImage(BACKGROUND_IMAGES[nextIndex]);
  }, [currentIndex]);

  return (
    <>
      <div aria-hidden="true" className="app-background">
        <div
          className="app-background__layer app-background__layer--current"
          style={{
            backgroundImage: `url("${BACKGROUND_IMAGES[currentIndex]}")`,
          }}
        />
        {outgoingIndex !== null && (
          <div
            className="app-background__layer app-background__layer--outgoing"
            key={`${outgoingIndex}-${currentIndex}`}
            style={{
              backgroundImage: `url("${BACKGROUND_IMAGES[outgoingIndex]}")`,
            }}
          />
        )}
        <div className="app-background__shade" />
        <div className="app-background__menu-dim" />
      </div>
      {children}
    </>
  );
}
