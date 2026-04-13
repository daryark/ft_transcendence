import quickIcon from '../../../public/button-icons/quickplay.svg';
import leagueIcon from '../../../public/button-icons/league.svg';
import customIcon from '../../../public/button-icons/customgame.svg';
import roomsIcon from '../../../public/button-icons/roomlisting.svg';

export const multiplayerModes = [
  {
    id: "quick",
    path: quickIcon,
    title: "Quick Game",
    description: "Fast match",
    route: "/play/multiplayer/quick",
  },
  {
    id: "league",
    path: leagueIcon,
    title: "Tetra League",
    description: "Ranked matches",
    route: "/play/multiplayer/league",
  },
  {
    id: "custom",
    path: customIcon,
    title: "Custom Game",
    description: "Create your own lobby",
    route: "/play/multiplayer/custom",
  },
  {
    id: "rooms",
    path: roomsIcon,
    title: "Room List",
    description: "Join existing rooms",
    route: "/play/multiplayer/rooms",
  },
];