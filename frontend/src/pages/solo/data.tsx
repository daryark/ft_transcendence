import multiIcon from '../../../public/button-icons/multi.svg';

export const soloModes = [
  {
    id: "40lines",
    path: multiIcon,
    title: "40 Lines",
    description: "Clear 40 lines fast",
    route: "/game/solo/40lines",
  },
  {
    id: "blitz",
    path: multiIcon,
    title: "Blitz",
    description: "Score in 2 minutes",
    route: "/game/solo/blitz",
  },
  {
    id: "zen",
    path: multiIcon,
    title: "Zen",
    description: "Relaxed mode",
    route: "/game/solo/zen",
  },
];
