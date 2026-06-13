import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Play from "./pages/play/Play";
import TetraChannel from "./pages/tetra-channel/TetraChannel";
import About from "./pages/about/About";
import Auth from "./pages/auth/Auth";
import Leaderboard from "./pages/leaderboard/Leaderboard";
import NotFound from "./pages/notFound/NotFound";
import SoloModePage from "./pages/modes/solo/SoloModePage";
import Quick from "./pages/modes/multiplayer/Quick";
import League from "./pages/modes/multiplayer/League";
import Rooms from "./pages/modes/multiplayer/Rooms";
import Custom from "./pages/modes/multiplayer/Custom";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Profile from "./pages/profile/Profile";
import SocketConfigSync from "./socket/SocketConfigSync";
import OAuthSuccess from "./pages/auth/OAuthSuccess";
import GamePage from "./pages/game/GamePage";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary";
import { ToastProvider } from "./components/Toast/ToastProvider";
import { ConfirmProvider } from "./components/Confirm/ConfirmProvider";
import { MusicProvider } from "./music/MusicProvider";
import { NetworkProvider } from "./network/NetworkProvider";
import { ForbiddenPage, OfflinePage } from "./pages/system/SystemPage";

import "./styles/globals.scss";

function GameRoute() {
  const { gameId } = useParams<{ gameId: string }>();

  return <GamePage key={gameId} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <MusicProvider>
            <BrowserRouter>
              <SocketConfigSync />
              <NetworkProvider>
                <Routes>
                  <Route path="/" element={<Layout />}>
          <Route index element={<Auth />} />
          <Route
            path="play/*"
            element={
              <ProtectedRoute>
                <Play />
              </ProtectedRoute>
            }
          />

          <Route
            path="play/solo/:modeId"
            element={
              <ProtectedRoute>
                <SoloModePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="play/multiplayer/quick"
            element={
              <ProtectedRoute>
                <Quick />
              </ProtectedRoute>
            }
          />
          <Route
            path="play/multiplayer/league"
            element={
              <ProtectedRoute>
                <League />
              </ProtectedRoute>
            }
          />
          <Route
            path="play/multiplayer/rooms"
            element={
              <ProtectedRoute>
                <Rooms />
              </ProtectedRoute>
            }
          />
          <Route
            path="play/multiplayer/custom"
            element={
              <ProtectedRoute>
                <Custom />
              </ProtectedRoute>
            }
          />
          <Route
            path="play/multiplayer/custom/:roomCode"
            element={
              <ProtectedRoute>
                <Custom />
              </ProtectedRoute>
            }
          />


          {/* <Route path="channel/*" element={<TetraChannel />} /> */}

          {/* CHANNEL */}
          <Route path="channel" element={<TetraChannel />}></Route>
          <Route
            path="channel/leaderboards/:mode/:scope"
            element={<Leaderboard />}
          />
          <Route path="about" element={<About />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
          <Route path="offline" element={<OfflinePage />} />
          <Route path="profile/:username" element={<Profile />} />
          <Route
            path="game/:gameId"
            element={
              <ProtectedRoute>
                <GameRoute />
              </ProtectedRoute>
            }
          />
          <Route path="auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
                  </Route>

                  <Route path="auth/callback" element={<OAuthSuccess />} />
                </Routes>
              </NetworkProvider>
            </BrowserRouter>
          </MusicProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
