import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { authFetch } from "../../auth/authFetch";
import { type SessionUser } from "../../auth/session";
import { getAvatarStyle } from "./avatarStyle";
import "./ProfileHeader.scss";

type SimpleModeStats = {
  value?: string;
  achievedAgo?: string;
};

type ProfileModes = {
  fortyLines?: SimpleModeStats | null;
  blitz?: SimpleModeStats | null;
  quickPlay?: SimpleModeStats | null;
};

type ProfileDetails = {
  level?: number;
  modes?: ProfileModes;
};

type ApiProfileResponse =
  | ProfileDetails
  | { profile: ProfileDetails }
  | { miniprofile: ProfileDetails };

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

const unwrapProfile = (payload: ApiProfileResponse): ProfileDetails => {
  if (
    "miniprofile" in payload &&
    typeof payload.miniprofile === "object" &&
    payload.miniprofile !== null
  ) {
    return payload.miniprofile;
  }

  if (
    "profile" in payload &&
    typeof payload.profile === "object" &&
    payload.profile !== null
  ) {
    return payload.profile;
  }

  return payload as ProfileDetails;
};

type ProfileHeaderProps = {
  user: SessionUser;
  isOwnProfile?: boolean;
  onClose: () => void;
  onLogout?: () => void;
};

const ProfileHeader = ({
  user,
  isOwnProfile = false,
  onClose,
  onLogout,
}: ProfileHeaderProps) => {
  const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user.isAnonymous) {
      setProfileDetails(null);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const loadProfileDetails = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await authFetch(
          `/api/users/${encodeURIComponent(user.username)}/miniprofile`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("FAILED TO LOAD PROFILE STATS");
        }

        const payload = (await response.json()) as ApiProfileResponse;
        setProfileDetails(unwrapProfile(payload));
      } catch (nextError) {
        if (!controller.signal.aborted) {
          setProfileDetails(null);
          setError(
            nextError instanceof Error
              ? nextError.message
              : "FAILED TO LOAD PROFILE STATS",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadProfileDetails();

    return () => controller.abort();
  }, [user.isAnonymous, user.username]);

  const modes = profileDetails?.modes ?? {};
  const fortyLinesStats = modes.fortyLines;
  const blitzStats = modes.blitz;
  const quickPlayStats = modes.quickPlay;
  const level = profileDetails?.level ?? 1;

  return (
    <section
      className={`profileModal ${user.isAnonymous ? "anonymousProfile" : ""}`}
      aria-label="Profile"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button className="closeProfile" type="button" onClick={onClose}>
        CLOSE
      </button>

      <div className="profileHeader">
        <div className="profileAvatar" style={getAvatarStyle(user.avatarId)}>
          {user.isAnonymous ? "?" : ""}
        </div>
        <div>
          <h2>{user.username}</h2>
          {!user.isAnonymous && <p>{getJoinedText(user)}</p>}
        </div>
      </div>

      {user.isAnonymous ? (
        <div className="anonymousNotice">THIS USER IS PLAYING ANONYMOUSLY</div>
      ) : (
        <>
          <div className="profileLevel">
            <span className="levelBadge">{level}</span>
            <div className="profileLevelBar">
              <i
                style={{
                  width: `${Math.min(level % 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {error && <div className="profileStatsNotice">{error}</div>}

          <div className="profileStats">
            <article>
              <span>40 LINES</span>
              {isLoading ? (
                <strong>LOADING...</strong>
              ) : fortyLinesStats ? (
                <>
                  <strong>{fortyLinesStats.value ?? "NO RECORD"}</strong>
                  <small>{fortyLinesStats.achievedAgo ?? "PLAY A RUN"}</small>
                </>
              ) : (
                <>
                  <strong>NO RECORD</strong>
                  <small>PLAY A RUN</small>
                </>
              )}
            </article>
            <article>
              <span>QUICK PLAY</span>
              {isLoading ? (
                <strong>LOADING...</strong>
              ) : quickPlayStats ? (
                <>
                  <strong>{quickPlayStats.value ?? "NO RECORD"}</strong>
                  <small>{quickPlayStats.achievedAgo ?? "PLAY A RUN"}</small>
                </>
              ) : (
                <>
                  <strong>NO RECORD</strong>
                  <small>PLAY A RUN</small>
                </>
              )}
            </article>
            <article>
              <span>BLITZ</span>
              {isLoading ? (
                <strong>LOADING...</strong>
              ) : blitzStats ? (
                <>
                  <strong>{blitzStats.value ?? "NO RECORD"}</strong>
                  <small>{blitzStats.achievedAgo ?? "PLAY A RUN"}</small>
                </>
              ) : (
                <>
                  <strong>NO RECORD</strong>
                  <small>PLAY A RUN</small>
                </>
              )}
            </article>
          </div>
          <Link
            className="fullProfile"
            to={`/profile/${encodeURIComponent(user.username)}`}
            onClick={onClose}
          >
            VIEW FULL PROFILE
          </Link>
        </>
      )}

      {isOwnProfile && onLogout && (
        <button className="logoutButton" type="button" onClick={onLogout}>
          LOG OUT
        </button>
      )}
    </section>
  );
};

export default ProfileHeader;
