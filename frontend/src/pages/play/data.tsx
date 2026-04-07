import multiIcon from '../../../public/button-icons/multi.svg';
import soloIcon from '../../../public/button-icons/solo.svg';
import channelIcon from '../../../public/button-icons/channel.svg';
import aboutIcon from '../../../public/button-icons/about.svg';

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
    path: soloIcon,
    title: "Solo",
    description: "Challenge yourself and top the leaderboards",
    gradient: "blue",
    route: "/game/solo",
  },
  {
    id: "tetra_channel",
    path: channelIcon,
    title: "Tetra Channel",
    description: "Compete in brackets",
    gradient: "green",
    route: "/tetra-channel",
  },
  {
    id: "about",
    path: aboutIcon,
    title: "About",
    description: "All about Tetris",
    gradient: "green",
    route: "/about",
  },
];