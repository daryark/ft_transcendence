export interface GameMode {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  category: 'main' | 'solo' | 'multiplayer';
  badge?: string;
  gradient?: string;
}

export const GAME_MODES: Record<string, GameMode> = {
  // Main menu
  multiplayer: {
    id: 'multiplayer',
    title: 'MULTIPLAYER',
    description: 'PLAY ONLINE WITH FRIENDS AND FOES',
    icon: '/button-icons/multi.svg',
    route: '/play/multiplayer',
    category: 'main',
    gradient: 'purple',
  },
  solo: {
    id: 'solo',
    title: 'SOLO',
    description: 'CHALLENGE YOURSELF AND TOP THE LEADERBOARDS',
    icon: '/button-icons/solo.svg',
    route: '/play/solo',
    category: 'main',
    gradient: 'blue',
  },
  tetraChannel: {
    id: 'tetraChannel',
    title: 'TETRA CHANNEL',
    description: 'LEADERBOARDS, ACHIEVEMENTS, REPLAYS AND MORE',
    icon: '/button-icons/channel.svg',
    route: '/channel',
    category: 'main',
    gradient: 'green',
  },
  
  // Solo modes
  fortyLines: {
    id: 'fortyLines',
    title: '40 LINES',
    description: 'COMPLETE 40 LINES AS QUICKLY AS POSSIBLE',
    icon: '/button-icons/40l.svg',
    route: '/play/solo/40lines',
    category: 'solo',
  },
  blitz: {
    id: 'blitz',
    title: 'BLITZ',
    description: 'A TWO-MINUTE RACE AGAINST THE CLOCK',
    icon: '/button-icons/blitz.svg',
    route: '/play/solo/blitz',
    category: 'solo',
  },
  zen: {
    id: 'zen',
    title: 'ZEN',
    description: 'RELAX OR TRAIN IN THIS NEVERENDING MODE',
    icon: '/button-icons/zen.svg',
    route: '/play/solo/zen',
    category: 'solo',
  },
  
  // Multiplayer modes
  quickPlay: {
    id: 'quickPlay',
    title: 'QUICK PLAY',
    description: 'SCALE THE TOWER! HOW FAR CAN YOU GET?',
    icon: '/button-icons/quickplay.svg',
    route: '/play/multiplayer/quick',
    category: 'multiplayer',
    badge: 'PP2',
  },
  tetraLeague: {
    id: 'tetraLeague',
    title: 'TETRA LEAGUE',
    description: 'FIGHT PLAYERS OF YOUR SKILL IN RANKED DUELS',
    icon: '/button-icons/league.svg',
    route: '/play/multiplayer/league',
    category: 'multiplayer',
    badge: 'HLC',
  },
  customGame: {
    id: 'customGame',
    title: 'CUSTOM GAME',
    description: 'CREATE PUBLIC AND PRIVATE ROOMS TO PLAY BY YOUR RULES',
    icon: '/button-icons/customgame.svg',
    route: '/play/multiplayer/custom',
    category: 'multiplayer',
    badge: 'CTM',
  },
  roomListing: {
    id: 'roomListing',
    title: 'ROOM LISTING',
    description: 'JOIN PUBLIC GAMES',
    icon: '/button-icons/roomlisting.svg',
    route: '/play/multiplayer/rooms',
    category: 'multiplayer',
    badge: 'LST',
  },
};

// Хелперы для получения режимов по категориям
export const getModesByCategory = (category: GameMode['category']) => {
  return Object.values(GAME_MODES).filter(mode => mode.category === category);
};