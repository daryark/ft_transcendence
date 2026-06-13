export type SessionUser = {
  id: number;
  email: string;
  username: string;
  created_at: string | null;
  isAnonymous?: boolean;
  avatarId?: number;
};

export type SessionData = {
  user: SessionUser;
  token?: string;
};

const SESSION_EVENT = "tetra-session-change";
const SESSION_STORAGE_KEY = "tetra-session";
const ANONYMOUS_SESSION_STORAGE_KEY = "tetra-anonymous-session";
let currentSession: SessionData | null = null;

const emitSessionChange = () => {
  window.dispatchEvent(new Event(SESSION_EVENT));
};

type JwtPayload = {
  exp?: number;
};

const parseJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
};

export const isSessionExpired = (session: SessionData | null) => {
  if (!session?.token) {
    return false;
  }

  const payload = parseJwtPayload(session.token);

  return !!payload?.exp && Date.now() >= payload.exp * 1000;
};

const readStoredSession = (): SessionData | null => {
  try {
    const raw =
      window.sessionStorage.getItem(SESSION_STORAGE_KEY) ??
      window.localStorage.getItem(SESSION_STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as SessionData) : null;

    if (session && !isSessionExpired(session)) {
      return session;
    }

    const anonymousRaw = window.sessionStorage.getItem(
      ANONYMOUS_SESSION_STORAGE_KEY,
    );
    const anonymousSession = anonymousRaw
      ? (JSON.parse(anonymousRaw) as SessionData)
      : null;

    return anonymousSession?.user.isAnonymous ? anonymousSession : null;
  } catch {
    return null;
  }
};

const persistSession = (session: SessionData | null) => {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(ANONYMOUS_SESSION_STORAGE_KEY);
    return;
  }

  if (session.user.isAnonymous) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.sessionStorage.setItem(
      ANONYMOUS_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
    return;
  }

  window.sessionStorage.removeItem(ANONYMOUS_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const initializeSession = () => {
  currentSession = readStoredSession();
  persistSession(currentSession);

  return currentSession;
};

export const getSession = (): SessionData | null => {
  if (!currentSession) {
    initializeSession();
  }

  if (isSessionExpired(currentSession)) {
    clearSession();
  }

  return currentSession;
};

export const getSessionUser = (): SessionUser | null =>
  getSession()?.user ?? null;

export const getSessionToken = (): string | null =>
  getSession()?.token ?? null;

export const saveSession = (session: SessionData) => {
  currentSession = session;
  persistSession(session);

  emitSessionChange();
};

export const saveSessionUser = (user: SessionUser, token?: string) => {
  saveSession({ user, token });
};

export const clearSession = () => {
  currentSession = null;
  persistSession(null);
  emitSessionChange();
};

export const createAnonymousUser = (): SessionUser => ({
  id: Math.floor(Date.now() + Math.random() * 1000),
  email: "anonymous@local",
  username: `GUEST-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
  created_at: new Date().toISOString(),
  isAnonymous: true,
});

export const createAnonymousSession = (): SessionData => {
  const user = createAnonymousUser();

  return { user };
};

export const isAuthenticated = () => getSessionUser() !== null;

export const subscribeToSession = (callback: () => void) => {
  const listener = () => callback();

  window.addEventListener(SESSION_EVENT, listener);

  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
  };
};
