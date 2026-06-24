import { describe, expect, it } from "vitest";
import { userCapabilities } from "../../src/auth/capabilities";
import type { SessionUser } from "../../src/auth/session";

const registeredUser: SessionUser = {
  id: 1,
  email: "player@example.com",
  username: "PLAYER",
  created_at: null,
};

const anonymousUser: SessionUser = {
  ...registeredUser,
  id: 2,
  username: "GUEST",
  isAnonymous: true,
};

describe("user capabilities", () => {
  it("blocks all player-only features for signed-out users", () => {
    expect(userCapabilities(null)).toEqual({
      canPlaySolo: false,
      canPlayQuickPlay: false,
      canJoinPublicRooms: false,
      canCreatePrivateRooms: false,
      canCreatePublicRooms: false,
      canViewOwnProfile: false,
      canUsePersonalStats: false,
      canUseAchievements: false,
      canUseFriends: false,
      canUseCountryLeaderboards: false,
      isAnonymous: false,
      isRegistered: false,
    });
  });

  it("allows anonymous users to play but not use account features", () => {
    expect(userCapabilities(anonymousUser)).toMatchObject({
      canPlaySolo: true,
      canPlayQuickPlay: true,
      canJoinPublicRooms: true,
      canCreatePrivateRooms: true,
      canCreatePublicRooms: false,
      canUseFriends: false,
      isAnonymous: true,
      isRegistered: false,
    });
  });

  it("allows registered users to use account and public room features", () => {
    expect(userCapabilities(registeredUser)).toMatchObject({
      canCreatePublicRooms: true,
      canViewOwnProfile: true,
      canUsePersonalStats: true,
      canUseAchievements: true,
      canUseCountryLeaderboards: true,
      isAnonymous: false,
      isRegistered: true,
    });
  });
});
