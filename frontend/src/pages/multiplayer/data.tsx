import multiIcon from '../../../public/button-icons/multi.svg';

export const multiplayerModes = [
  {
    id: "quick",
    path: multiIcon,
    title: "Quick Game",
    description: "Fast match",
    route: "/game/multiplayer/quick",
  },
  {
    id: "league",
    path: multiIcon,
    title: "Tetra League",
    description: "Ranked matches",
    route: "/game/multiplayer/league",
  },
  {
    id: "custom",
    path: multiIcon,
    title: "Custom Game",
    description: "Create your own lobby",
    route: "/game/multiplayer/custom",
  },
  {
    id: "rooms",
    path: multiIcon,
    title: "Room List",
    description: "Join existing rooms",
    route: "/game/multiplayer/rooms",
  },
];