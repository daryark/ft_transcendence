import type { SessionUser } from "./session";

export const isAnonymousUser = (user: SessionUser | null | undefined) =>
  !!user?.isAnonymous;

export const isRegisteredUser = (user: SessionUser | null | undefined) =>
  !!user && !user.isAnonymous;

export const userCapabilities = (user: SessionUser | null | undefined) => {
  const signedIn = !!user;
  const anonymous = isAnonymousUser(user);
  const registered = isRegisteredUser(user);

  return {
    canPlaySolo: signedIn,
    canPlayQuickPlay: signedIn,
    canJoinPublicRooms: signedIn,
    canCreatePrivateRooms: signedIn,
    canCreatePublicRooms: registered,
    canViewOwnProfile: registered,
    canUsePersonalStats: registered,
    canUseAchievements: registered,
    canUseFriends: registered,
    canUseCountryLeaderboards: registered,
    isAnonymous: anonymous,
    isRegistered: registered,
  };
};
