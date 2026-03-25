import multiIcon from '../../../public/button-icons/multi.svg';

export const gameModes = [
  {
    id: "multiplayer",
    path: multiIcon,
    title: "Multiplayer",
    description: "Play online with friends and foes",
    gradient: "purple",
    route: "/game/multiplayer",
  },
  {
    id: "solo",
    path: multiIcon,
    title: "Solo",
    description: "Challenge yourself and top the leaderboards",
    gradient: "blue",
    route: "/game/solo",
  },
  {
    id: "tetra_channel",
    path: multiIcon,
    title: "Tetra Channel",
    description: "Compete in brackets",
    gradient: "green",
    route: "/tetra-channel",
  },
  {
    id: "about",
    path: multiIcon,
    title: "About",
    description: "All about Tetris",
    gradient: "green",
    route: "/about",
  },
];