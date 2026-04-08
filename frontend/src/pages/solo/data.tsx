import l40Icon from '../../../public/button-icons/40l.svg';
import blitzIcon from '../../../public/button-icons/blitz.svg';
import zenIcon from '../../../public/button-icons/zen.svg';
// import multiIcon from '../../../public/button-icons/multi.svg';

export const soloModes = [
  {
    id: "40lines",
    path: l40Icon,
    title: "40 Lines",
    description: "Clear 40 lines fast",
    route: "/game/solo/40lines",
  },
  {
    id: "blitz",
    path: blitzIcon,
    title: "Blitz",
    description: "Score in 2 minutes",
    route: "/game/solo/blitz",
  },
  {
    id: "zen",
    path: zenIcon,
    title: "Zen",
    description: "Relaxed mode",
    route: "/game/solo/zen",
  },
];
