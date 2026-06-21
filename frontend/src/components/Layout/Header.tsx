import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ProfileHeader from "../ProfileHeader/ProfileHeader";
import { getAvatarStyle } from "../ProfileHeader/avatarStyle";
import SocialPanels from "../SocialPanels/SocialPanels";
import NotificationsPanel from "../Notifications/NotificationsPanel";
import Dialog from "../Dialog/Dialog";
import { apiJson } from "../../api/client";

import {
  clearSession,
  getSessionUser,
  subscribeToSession,
  type SessionUser,
} from "../../auth/session";
import "./Header.scss";

const titles: Record<string, string> = {
  play: "PLAY",
  multiplayer: "MULTIPLAYER",
  solo: "SOLO",
  quick: "QUICK PLAY",
  rooms: "ROOM LISTING",
  custom: "CUSTOM GAME",
  channel: "TETRA CHANNEL",
  leaderboards: "LEADERBOARDS",
  statistics: "MY STATISTICS",
  achievements: "ACHIEVEMENTS",
  about: "ABOUT",
  auth: "AUTH",
};

type SocialTab = "friends" | "requests" | "blocked";

const getPageTitle = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0 || pathname === "/play") {
    return "HOME";
  }

  if (parts[0] === "channel" && parts[1] === "leaderboards") {
    return titles.leaderboards;
  }

  if (parts[0] === "profile") {
    return null;
  }

  const lastPart = parts[parts.length - 1];

  return titles[lastPart] || lastPart.replaceAll("-", " ").toUpperCase();
};

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(() => getSessionUser());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isLoggedIn = user !== null;

  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [socialInitialTab, setSocialInitialTab] = useState<SocialTab>("friends");
  const [socialConversationUserId, setSocialConversationUserId] = useState<
    number | null
  >(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [playerMeta, setPlayerMeta] = useState({
    level: 1,
  });
  const canUseAccountPanels = Boolean(user && !user.isAnonymous);

  const isActive = (path: string) => location.pathname === path;
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    setIsProfileOpen(false);
    setIsSocialOpen(false);
    setIsNotificationsOpen(false);
    clearSession();
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    return subscribeToSession(() => {
      const nextUser = getSessionUser();

      setUser(nextUser);
      if (!nextUser) {
        setIsProfileOpen(false);
      }
    });
  }, []);

  useEffect(() => {
    const shouldFadeFooter = isSocialOpen || isNotificationsOpen;
    document.body.classList.toggle("app-panel-open", shouldFadeFooter);

    return () => {
      document.body.classList.remove("app-panel-open");
    };
  }, [isNotificationsOpen, isSocialOpen]);

  useEffect(() => {
    const openNotifications = () => {
      setIsSocialOpen(false);
      setIsNotificationsOpen(true);
    };
    const openSocial = () => {
      setSocialInitialTab("friends");
      setIsNotificationsOpen(false);
      setIsSocialOpen(true);
    };

    window.addEventListener("tetra:open-notifications", openNotifications);
    window.addEventListener("tetra:open-social", openSocial);
    return () => {
      window.removeEventListener("tetra:open-notifications", openNotifications);
      window.removeEventListener("tetra:open-social", openSocial);
    };
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      return;
    }

    const controller = new AbortController();
    void apiJson<{
      miniprofile?: {
        level?: number;
      };
      profile?: {
        level?: number;
      };
      level?: number;
    }>(`/api/users/${encodeURIComponent(user.username)}/miniprofile`, {
      signal: controller.signal,
    })
      .then((payload) => {
        const profile = payload.miniprofile ?? payload.profile ?? payload;
        setPlayerMeta({
          level: profile.level ?? 1,
        });
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setPlayerMeta({ level: 1 });
        }
      });

    return () => controller.abort();
  }, [user]);

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="content">
            <div className="left">
              {isLoggedIn ? (
                pageTitle ? <div className="pageTitle">{pageTitle}</div> : null
              ) : (
                <nav className="nav">
                  <Link
                    to="/play"
                    className={`navLink ${isActive("/play") ? "active" : ""}`}
                  >
                    Play
                  </Link>
                  <Link
                    to="/channel"
                    className={`navLink ${isActive("/channel") ? "active" : ""}`}
                  >
                    Tetra Channel
                  </Link>
                  <Link
                    to="/about"
                    className={`navLink ${isActive("/about") ? "active" : ""}`}
                  >
                    About
                  </Link>
                </nav>
              )}
            </div>

            <div className="right">
              {user ? (
                <>
                  {canUseAccountPanels && (
                    <>
                      <NotificationsPanel
                        isOpen={isNotificationsOpen}
                        onClose={() => setIsNotificationsOpen(false)}
                        onUnreadCountChange={setNotificationCount}
                        onOpenSocialTab={(tab, conversationUserId) => {
                          setSocialInitialTab(tab);
                          setSocialConversationUserId(conversationUserId ?? null);
                          setIsSocialOpen(true);
                        }}
                      />
                      <SocialPanels
                        isOpen={isSocialOpen}
                        onClose={() => {
                          setIsSocialOpen(false);
                          setSocialConversationUserId(null);
                        }}
                        initialTab={socialInitialTab}
                        initialConversationUserId={socialConversationUserId}
                        onInitialConversationOpened={() =>
                          setSocialConversationUserId(null)
                        }
                      />
                    </>
                  )}
                  {canUseAccountPanels && (
                    <button
                      className="notificationsButton"
                      type="button"
                      onClick={() => {
                        setIsSocialOpen(false);
                        setIsNotificationsOpen(true);
                      }}
                    >
                      🔔
                      {notificationCount > 0 && (
                        <span className="notificationsButtonBadge">{notificationCount}</span>
                      )}
                    </button>
                  )}
                  {canUseAccountPanels && (
                    <button
                      className="socialButton"
                      type="button"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        setSocialInitialTab("friends");
                        setSocialConversationUserId(null);
                        setIsSocialOpen(true);
                      }}
                    >
                      SOCIAL
                    </button>
                  )}

                  <button
                    className={`playerCard ${
                      user.isAnonymous ? "anonymousCard" : ""
                    }`}
                    type="button"
                    onClick={() => setIsProfileOpen(true)}
                    aria-label="Open profile"
                  >
                    <span className="playerText">
                      <span className="playerName">{user.username}</span>

                      {user.isAnonymous ? (
                        <span className="anonymousLabel">ANONYMOUS</span>
                      ) : (
                        <span className="playerMeta">
                          <span className="levelBadge">{playerMeta.level}</span>
                        </span>
                      )}
                    </span>

                    <span
                      className="playerAvatar"
                      style={getAvatarStyle(user.avatarId)}
                    >
                      {user.isAnonymous ? "?" : ""}
                    </span>
                  </button>
                </>
              ) : (<></> 
                // <Link
                //   to="/auth"
                //   className="userIcon"
                //   aria-label="Sign up / Log in"
                // >
                //   <UserIcon />
                // </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {user && isProfileOpen && (
        <Dialog
          className="profileOverlay"
          label={`${user.username} profile`}
          onClose={() => setIsProfileOpen(false)}
        >
          <ProfileHeader
            user={user}
            isOwnProfile
            onClose={() => setIsProfileOpen(false)}
            onLogout={handleLogout}
          />
        </Dialog>
      )}
    </>
  );
};

export default Header;
