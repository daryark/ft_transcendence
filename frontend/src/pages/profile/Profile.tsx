import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useParams } from "react-router-dom";
import { authFetch } from "../../auth/authFetch";
import {
  getSessionToken,
  getSessionUser,
  saveSession,
  type SessionUser,
} from "../../auth/session";
import "./Profile.scss";
import Dialog from "../../components/Dialog/Dialog";
import { EmptyState, Skeleton } from "../../components/StateView/StateView";

type ModeKey = "league" | "quickPlay" | "fortyLines" | "blitz" | "zen";

type LeagueStats = {
  tr: number;
  glicko: number;
  rank: string;
};

type SimpleModeStats = {
  value: string;
  achievedAgo?: string;
};

type ProfileModes = {
  league?: LeagueStats | null;
  quickPlay?: SimpleModeStats | null;
  fortyLines?: SimpleModeStats | null;
  blitz?: SimpleModeStats | null;
  zen?: SimpleModeStats | null;
};

type ApiProfileResponse = PlayerProfile | { profile: PlayerProfile };

type PlayerProfile = {
  id: number;
  username: string;
  country?: string;
  avatarId: number;
  created_at: string | null;
  level: number;
  xp: number;
  nextLevelXp: number;
  playTimeHours: number;
  onlineGames: number;
  wins: number;
  leagueGames?: number;
  leagueWins?: number;
  modes: ProfileModes;
};

type EditProfilePayload = {
  avatarId: number;
  newPassword?: string;
};

const avatarColors = [
  "#d6cc1e",
  "#8ed053",
  "#6ec6ff",
  "#ff7f50",
  "#c986ff",
  "#ffcc66",
  "#6ee7b7",
  "#ef6f8f",
  "#a7f3d0",
  "#f97316",
  "#93c5fd",
  "#f0abfc",
  "#fde047",
  "#34d399",
  "#fb7185",
];

const modeTitles: Record<ModeKey, string> = {
  league: "TETRA LEAGUE",
  quickPlay: "QUICK PLAY",
  fortyLines: "40 LINES",
  blitz: "BLITZ",
  zen: "ZEN",
};

const modeAccents: Record<ModeKey, string> = {
  league: "#9d64c8",
  quickPlay: "#f04b22",
  fortyLines: "#e47c2e",
  blitz: "#5f8b5b",
  zen: "#69a06c",
};

const clampAvatarId = (avatarId?: number) => {
  if (!avatarId || avatarId < 1 || avatarId > avatarColors.length) {
    return 1;
  }

  return avatarId;
};

const getAvatarColor = (avatarId: number) =>
  avatarColors[clampAvatarId(avatarId) - 1];

const formatJoinedText = (createdAt: string | null) => {
  if (!createdAt) {
    return "JOINED TODAY";
  }

  const created = new Date(createdAt).getTime();

  if (Number.isNaN(created)) {
    return "JOINED TODAY";
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)),
  );

  if (days === 0) {
    return "JOINED TODAY";
  }

  if (days < 31) {
    return `JOINED ${days} DAYS AGO`;
  }

  const months = Math.floor(days / 30);

  return `JOINED ${months} ${months === 1 ? "MONTH" : "MONTHS"} AGO`;
};

const formatPlayTime = (hours: number) => {
  if (hours <= 0) return "0 hours";
  if (hours < 1) return `${Math.round(hours * 60)} min`;

  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString()} ${rounded === 1 ? "hour" : "hours"}`;
};

const parseErrorMessage = async (res: Response) => {
  try {
    const payload = (await res.json()) as { error?: string; message?: string };

    return payload.error || payload.message;
  } catch {
    return undefined;
  }
};

const hasProfileEnvelope = (
  payload: ApiProfileResponse,
): payload is { profile: PlayerProfile } =>
  "profile" in payload && typeof payload.profile === "object";

const normalizeProfile = (payload: ApiProfileResponse): PlayerProfile => {
  const profile = hasProfileEnvelope(payload) ? payload.profile : payload;

  return {
    ...profile,
    avatarId: clampAvatarId(profile.avatarId),
    level: profile.level ?? 1,
    xp: profile.xp ?? 0,
    nextLevelXp: profile.nextLevelXp ?? 0,
    playTimeHours: profile.playTimeHours ?? 0,
    onlineGames: profile.leagueGames ?? profile.onlineGames ?? 0,
    wins: profile.leagueWins ?? profile.wins ?? 0,
    leagueGames: profile.leagueGames ?? profile.onlineGames ?? 0,
    leagueWins: profile.leagueWins ?? profile.wins ?? 0,

    modes: profile.modes ?? {},
  };
};

const fetchProfile = async (
  username: string,
  signal: AbortSignal,
): Promise<PlayerProfile> => {
  const res = await authFetch(
    `/api/users/${encodeURIComponent(username)}/profile`,
    { signal },
  );

  if (!res.ok) {
    throw new Error(
      (await parseErrorMessage(res)) ||
        `Profile API returned ${res.status} ${res.statusText}`,
    );
  }

  return normalizeProfile((await res.json()) as ApiProfileResponse);
};

const updateProfileOnServer = async (payload: EditProfilePayload) => {
  const profileRes = await authFetch("/api/users/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ avatarId: payload.avatarId }),
  });

  if (!profileRes.ok) {
    throw new Error("Failed to update profile");
  }

  if (payload.newPassword) {
    const passwordRes = await authFetch("/api/users/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: payload.newPassword,
      }),
    });

    if (!passwordRes.ok) {
      throw new Error("Failed to update password");
    }
  }
};

const AvatarBlock = ({
  avatarId,
  className = "",
}: {
  avatarId: number;
  className?: string;
}) => (
  <div
    className={`profile-page__avatar ${className}`}
    style={{ "--avatar-color": getAvatarColor(avatarId) } as CSSProperties}
  />
);

const NeverPlayed = () => (
  <div className="profile-page__never">Never played</div>
);

const LeaguePanel = ({ stats }: { stats?: LeagueStats | null }) => (
  <section
    className="profile-page__panel profile-page__panel--league"
    style={{ "--mode-accent": modeAccents.league } as CSSProperties}
  >
    <div className="profile-page__tag">{modeTitles.league}</div>
    {!stats ? (
      <NeverPlayed />
    ) : (
      <>
        <div className="profile-page__panelTop">
          <div className="profile-page__leagueScore">
            <span>{stats.rank}</span>
            <strong>{stats.tr.toLocaleString()} TR</strong>
            <small>Glicko: {stats.glicko}</small>
          </div>
        </div>
      </>
    )}
  </section>
);

const SimplePanel = ({
  mode,
  stats,
}: {
  mode: Exclude<ModeKey, "league">;
  stats?: SimpleModeStats | null;
}) => (
  <section
    className={`profile-page__panel profile-page__panel--${mode}`}
    style={{ "--mode-accent": modeAccents[mode] } as CSSProperties}
  >
    <div className="profile-page__tag">{modeTitles[mode]}</div>
    {!stats ? (
      <NeverPlayed />
    ) : (
      <>
        <div className="profile-page__panelTop">
          <div className="profile-page__modeScore">
            <strong>{stats.value}</strong>
            <small>
              {stats.achievedAgo && <>Achieved {stats.achievedAgo}</>}
            </small>
          </div>
        </div>
      </>
    )}
  </section>
);

const EditProfileModal = ({
  profile,
  onClose,
  onSave,
}: {
  profile: PlayerProfile;
  onClose: () => void;
  onSave: (payload: EditProfilePayload) => Promise<void>;
}) => {
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        return;
      }
    }

    try {
      setSaving(true);
      await onSave({
        avatarId,
        newPassword: newPassword || undefined,
      });
      setStatus("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      className="profile-page__editOverlay"
      label="Edit profile"
      onClose={onClose}
    >
      <form className="profile-page__editModal" onSubmit={handleSubmit}>
        <button
          className="profile-page__editClose"
          type="button"
          onClick={onClose}
        >
          CLOSE
        </button>
        <h2>Edit profile</h2>

        <div className="profile-page__avatarGrid" aria-label="Choose avatar">
          {avatarColors.map((color, index) => {
            const nextAvatarId = index + 1;

            return (
              <button
                key={color}
                className={
                  avatarId === nextAvatarId
                    ? "profile-page__avatarChoice profile-page__avatarChoice--active"
                    : "profile-page__avatarChoice"
                }
                type="button"
                style={{ "--avatar-color": color } as CSSProperties}
                onClick={() => setAvatarId(nextAvatarId)}
                aria-label={`Avatar ${nextAvatarId}`}
              />
            );
          })}
        </div>

        <div className="profile-page__passwordFields">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            minLength={8}
            autoComplete="new-password"
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            minLength={8}
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {error && <p className="profile-page__editError">{error}</p>}
        {status && <p className="profile-page__editStatus">{status}</p>}

        <button className="profile-page__save" type="submit" disabled={saving}>
          {saving ? "SAVING..." : "SAVE CHANGES"}
        </button>
      </form>
    </Dialog>
  );
};

export default function Profile() {
  const { username = "" } = useParams<{ username: string }>();
  const decodedUsername = useMemo(
    () => decodeURIComponent(username || "admin"),
    [username],
  );

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() =>
    getSessionUser(),
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const isOwnProfile =
    !!sessionUser &&
    !!profile &&
    !sessionUser.isAnonymous &&
    (sessionUser.id === profile.id ||
      sessionUser.username.toLowerCase() === profile.username.toLowerCase());

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const loadProfile = async () => {
      const currentUser = getSessionUser();
      setSessionUser(currentUser);
      setLoading(true);
      setError("");
      setProfile(null);

      try {
        if (
          currentUser?.isAnonymous &&
          currentUser.username.toLowerCase() === decodedUsername.toLowerCase()
        ) {
          throw new Error("Anonymous users do not have profiles.");
        }

        const data = await fetchProfile(decodedUsername, controller.signal);

        if (!ignore) {
          setProfile(data);
        }
      } catch (err) {
        if (
          !ignore &&
          !(err instanceof DOMException && err.name === "AbortError")
        ) {
          setError(
            err instanceof Error
              ? err.message
              : "Profile data could not be loaded.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [decodedUsername]);

  const handleSave = async (payload: EditProfilePayload) => {
    await updateProfileOnServer(payload);

    setProfile((current) =>
      current ? { ...current, avatarId: payload.avatarId } : current,
    );

    if (sessionUser) {
      const nextUser = { ...sessionUser, avatarId: payload.avatarId };
      setSessionUser(nextUser);
      saveSession({
        user: nextUser,
        token: getSessionToken() ?? undefined,
      });
    }
  };

  if (loading) {
    return (
      <div className="profile-page profile-page--state">
        <Skeleton lines={7} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page profile-page--state">
        <EmptyState
          title="PROFILE UNAVAILABLE"
          message={error || "The requested profile could not be found."}
        />
      </div>
    );
  }

  const xpPercent =
    profile.nextLevelXp > 0
      ? Math.min(100, Math.round((profile.xp / profile.nextLevelXp) * 100))
      : 0;

  return (
    <div className="profile-page">
      <div className="profile-page__wrap">
        <header className="profile-page__top">
          <h1>
            {profile.username}
            {profile.country && <span>{profile.country}</span>}
          </h1>
        </header>

        <div className="profile-page__grid">
          <aside className="profile-page__sidebar">
            <AvatarBlock avatarId={profile.avatarId} />
            <section className="profile-page__summary">
              <strong>{formatJoinedText(profile.created_at)}</strong>
              <div className="profile-page__level">
                <span>{profile.level}</span>
                <div>
                  <i style={{ width: `${xpPercent}%` }} />
                </div>
                <small>{profile.xp.toLocaleString()} XP</small>
              </div>
              <dl>
                <dt>PLAY TIME</dt>
                <dd>{formatPlayTime(profile.playTimeHours)}</dd>
                <dt>TOTAL LEAGUE GAMES</dt>
                <dd>{profile.leagueGames ?? profile.onlineGames}</dd>
                <dt>LEAGUE WINS</dt>
                <dd>{profile.leagueWins ?? profile.wins}</dd>
              </dl>
              <small>User ID: {profile.id || "local-preview"}</small>
            </section>
            {isOwnProfile && (
              <button
                className="profile-page__editButton"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                EDIT PROFILE
              </button>
            )}
          </aside>

          <main className="profile-page__content">
            {error && <p className="profile-page__notice">{error}</p>}
            <LeaguePanel stats={profile.modes.league} />
            <SimplePanel mode="quickPlay" stats={profile.modes.quickPlay} />
            <SimplePanel mode="fortyLines" stats={profile.modes.fortyLines} />
            <SimplePanel mode="blitz" stats={profile.modes.blitz} />
            {/* <AchievementsPanel achievements={profile.achievements} /> */}
            <SimplePanel mode="zen" stats={profile.modes.zen} />
          </main>
        </div>
      </div>

      {isEditing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
