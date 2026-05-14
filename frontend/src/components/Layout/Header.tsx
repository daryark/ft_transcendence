import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import UserIcon from "../Icons/UserIcon";
import SocialPanels from "../SocialPanels/SocialPanels";

import {
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

const getJoinedText = (user: SessionUser) => {
  if (!user.created_at) {
    return "JOINED TODAY";
  }

  const createdAt = new Date(user.created_at).getTime();

  if (Number.isNaN(createdAt)) {
    return "JOINED TODAY";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24)),
  );

  return days === 0 ? "JOINED TODAY" : `JOINED ${days} DAYS AGO`;
};

const Header = () => {
  const location = useLocation();
  const [user, setUser] = useState<SessionUser | null>(() => getSessionUser());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isLoggedIn = user !== null;

  const [isSocialOpen, setIsSocialOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const pageTitle = getPageTitle(location.pathname);

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
                <div className={pageTitle}>{pageTitle}</div>
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

                    <span className="playerAvatar">
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
          <section
            className={`profileModal ${
              user.isAnonymous ? "anonymousProfile" : ""
            }`}
            aria-label="Profile"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="closeProfile"
              type="button"
              onClick={() => setIsProfileOpen(false)}
            >
              CLOSE
            </button>

            <div className="profileHeader">
              <div className="profileAvatar">{user.isAnonymous ? "?" : ""}</div>
              <div>
                <h2>{user.username}</h2>
                {!user.isAnonymous && <p>{getJoinedText(user)} - HEARTS 0</p>}
              </div>
            </div>

            {isLoggedIn &&
              (user.isAnonymous ? (
                <div className="anonymousNotice">
                  THIS USER IS PLAYING ANONYMOUSLY
                </div>
              ) : (
                <>
                  <div className="profileLevel">
                    <span className="levelBadge">0</span>
                  </div>
                  <div className="profileStats">
                    <article>
                      <span>TETRA LEAGUE</span>
                      <strong>0 TR</strong>
                      <small>0 APM 0 PPS 0 VS</small>
                    </article>
                    <article>
                      <span>40 LINES</span>
                      <strong>0:00.000</strong>
                      <small>NO RECORD</small>
                    </article>
                    <article>
                      <span>QUICK PLAY</span>
                      <strong>0 M</strong>
                      <small>NO RECORD</small>
                    </article>
                  </div>
                  <button className="fullProfile" type="button">
                    VIEW FULL PROFILE
                  </button>
                </>
              ))}
          </section>
        </div>
      )}
    </>
  );
};

export default Header;
