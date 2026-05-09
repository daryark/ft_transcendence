// pages/play/data.ts

// Иконки для главного меню
import multiIcon from "../../../public/button-icons/multi.svg";
import soloIcon from "../../../public/button-icons/solo.svg";
import channelIcon from "../../../public/button-icons/channel.svg";
import aboutIcon from "../../../public/button-icons/about.svg";

// Иконки для multiplayer
import quickIcon from "../../../public/button-icons/quickplay.svg";
import leagueIcon from "../../../public/button-icons/league.svg";
import customIcon from "../../../public/button-icons/customgame.svg";
import roomsIcon from "../../../public/button-icons/roomlisting.svg";

// Иконки для solo
import l40Icon from "../../../public/button-icons/40l.svg";
import blitzIcon from "../../../public/button-icons/blitz.svg";
import zenIcon from "../../../public/button-icons/zen.svg";

export interface Mode {
  id: string;
  path: string;
  title: string;
  description: string;
  route: string;
}

// Все режимы игры
export const ALL_MODES: Record<string, Mode[]> = {
  // Main
  "/play": [
    {
      id: "multiplayer",
      path: multiIcon,
      title: "MULTIPLAYER",
      description: "PLAY ONLINE WITH FRIENDS AND FOES",
      route: "/play/multiplayer",
    },
    {
      id: "solo",
      path: soloIcon,
      title: "SOLO",
      description: "CHALLENGE YOURSELF AND TOP THE LEADERBOARDS",
      route: "/play/solo",
    },
    {
      id: "tetra_channel",
      path: channelIcon,
      title: "TETRA CHANNEL",
      description: "LEADERBOARDS, ACHIEVEMENTS, REPLAYS AND MORE",
      route: "/channel",
    },
    {
      id: "about",
      path: aboutIcon,
      title: "ABOUT",
      description: "ALL ABOUT TETR.IO",
      route: "/about",
    },
  ],

  // Multiplayer
  "/play/multiplayer": [
    {
      id: "quick",
      path: quickIcon,
      title: "QUICK PLAY",
      description: "SCALE THE TOWER! HOW FAR CAN YOU GET?",
      route: "/play/multiplayer/quick",
    },
    {
      id: "league",
      path: leagueIcon,
      title: "TETRA LEAGUE",
      description: "FIGHT PLAYERS OF YOUR SKILL IN RANKED DUELS",
      route: "/play/multiplayer/league",
    },
    {
      id: "custom",
      path: customIcon,
      title: "CUSTOM GAME",
      description: "CREATE PUBLIC AND PRIVATE ROOMS TO PLAY BY YOUR RULES",
      route: "/play/multiplayer/custom",
    },
    {
      id: "rooms",
      path: roomsIcon,
      title: "ROOM LISTING",
      description: "JOIN PUBLIC GAMES",
      route: "/play/multiplayer/rooms",
    },
  ],

  // Solo
  "/play/solo": [
    {
      id: "40lines",
      path: l40Icon,
      title: "40 LINES",
      description: "COMPLETE 40 LINES AS QUICKLY AS POSSIBLE",
      route: "/play/solo/40lines",
    },
    {
      id: "blitz",
      path: blitzIcon,
      title: "BLITZ",
      description: "A TWO-MINUTE RACE AGAINST THE CLOCK",
      route: "/play/solo/blitz",
    },
    {
      id: "zen",
      path: zenIcon,
      title: "ZEN",
      description: "RELAX OR TRAIN IN THIS NEVERENDING MODE",
      route: "/play/solo/zen",
    },
  ],
};

export const getModesByPath = (path: string): Mode[] => {
  // Точное совпадение
  if (ALL_MODES[path]) {
    return ALL_MODES[path];
  }

  if (path.startsWith("/play/multiplayer/")) {
    return ALL_MODES["/play/multiplayer"];
  }

  if (path.startsWith("/play/solo/")) {
    return ALL_MODES["/play/solo"];
  }

  //default
  return ALL_MODES["/play"];
};
