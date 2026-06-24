import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSocket, subscribeToSocket } from "../socket/socketClient";

export type NetworkStatus = "online" | "reconnecting" | "offline";

const NetworkContext = createContext<NetworkStatus>("online");

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [socketConnected, setSocketConnected] = useState(
    () => getSocket()?.connected ?? false,
  );
  const [hasConnected, setHasConnected] = useState(socketConnected);

  useEffect(() => {
    const online = () => setBrowserOnline(true);
    const offline = () => setBrowserOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(
    () => {
      let removeSocketListeners = () => undefined;
      const unsubscribe = subscribeToSocket(() => {
        removeSocketListeners();
        const socket = getSocket();
        const update = () => {
          const connected = socket?.connected ?? false;
          setSocketConnected(connected);
          if (connected) setHasConnected(true);
        };
        update();
        socket?.on("connect", update);
        socket?.on("disconnect", update);
        removeSocketListeners = () => {
          socket?.off("connect", update);
          socket?.off("disconnect", update);
        };
      });

      const socket = getSocket();
      const update = () => {
        const connected = socket?.connected ?? false;
        setSocketConnected(connected);
        if (connected) setHasConnected(true);
      };
      socket?.on("connect", update);
      socket?.on("disconnect", update);
      removeSocketListeners = () => {
        socket?.off("connect", update);
        socket?.off("disconnect", update);
      };

      return () => {
        removeSocketListeners();
        unsubscribe();
      };
    },
    [],
  );

  const status = useMemo<NetworkStatus>(() => {
    if (!browserOnline) return "offline";
    if (socketConnected) return "online";
    return hasConnected ? "reconnecting" : "offline";
  }, [browserOnline, hasConnected, socketConnected]);

  return (
    <NetworkContext.Provider value={status}>
      {children}
    </NetworkContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNetworkStatus = () => useContext(NetworkContext);
