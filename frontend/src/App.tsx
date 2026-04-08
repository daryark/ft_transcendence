import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Play from "./pages/play/Play";
import TetraChannel from "./pages/tetra-channel/TetraChannel";
import About from "./pages/about/About";
import Auth from "./pages/auth/Auth";
import Multiplayer from "./pages/multiplayer/Multiplayer";
import Solo from "./pages/solo/Solo";
import "./styles/globals.scss";
import GameBoard from "./components/GameBoard/GameBoard";
import SoloGame from "./pages/game/SoloGame";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Play />} />
          <Route path="play" element={<Play />} />
          <Route path="tetra-channel" element={<TetraChannel />} />
          <Route path="about" element={<About />} />
          <Route path="auth" element={<Auth />} />
          <Route path="game/multiplayer" element={<Multiplayer />} />
          <Route path="game/solo" element={<Solo />} />
          <Route path="game/solo/40lines" element={<SoloGame/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


