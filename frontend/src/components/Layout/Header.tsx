import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ProfileHeader, { getAvatarStyle } from "../ProfileHeader/ProfileHeader";
import SocialPanels from "../SocialPanels/SocialPanels";

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
  league: "TETRA LEAGUE",
  rooms: "ROOM LISTING",
  custom: "CUSTOM GAME",
  channel: "TETRA CHANNEL",
  leaderboards: "LEADERBOARDS",
  about: "ABOUT",
  auth: "AUTH",
};

const getPageTitle = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length === 0 || pathname === "/play") {
    return "HOME";
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

  const isActive = (path: string) => location.pathname === path;
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    setIsProfileOpen(false);
    setIsSocialOpen(false);
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

  return (
    <>
      <header className="header">
        <div className="container">
          <div className="content">
            <div className="left">
              {isLoggedIn ? (
                <div className="pageTitle">{pageTitle}</div>
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
                  <SocialPanels
                    isOpen={isSocialOpen}
                    onClose={() => setIsSocialOpen(false)}
                  />
                  {!user.isAnonymous && (
                    <button
                      className="socialButton"
                      type="button"
                      onClick={() => setIsSocialOpen(true)}
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
                          <span className="levelBadge">0</span>
                          <span className="rankBadge">0</span>
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
        <div
          className="profileOverlay"
          role="presentation"
          onMouseDown={() => setIsProfileOpen(false)}
        >
          <ProfileHeader
            user={user}
            isOwnProfile
            onClose={() => setIsProfileOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      )}
    </>
  );
};

export default Header;
