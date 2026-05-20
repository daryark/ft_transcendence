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
let currentSession: SessionData | null = null;

const emitSessionChange = () => {
  window.dispatchEvent(new Event(SESSION_EVENT));
};

const toBase64Url = (value: unknown) =>
  window
    .btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

export const getSession = (): SessionData | null => currentSession;

export const getSessionUser = (): SessionUser | null =>
  currentSession?.user ?? null;

export const getSessionToken = (): string | null =>
  currentSession?.token ?? null;

export const saveSession = (session: SessionData) => {
  currentSession = session;

  emitSessionChange();
};

export const saveSessionUser = (user: SessionUser, token?: string) => {
  saveSession({ user, token });
};

export const clearSession = () => {
  currentSession = null;
  emitSessionChange();
};

export const createAnonymousUser = (): SessionUser => ({
  id: Date.now(),
  email: "anonymous@local",
  username: `GUEST-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
  created_at: new Date().toISOString(),
  isAnonymous: true,
});

export const createAnonymousSession = (): SessionData => {
  const user = createAnonymousUser();
  const now = Math.floor(Date.now() / 1000);
  const token = [
    toBase64Url({ alg: "none", typ: "JWT" }),
    toBase64Url({
      sub: user.id,
      email: user.email,
      username: user.username,
      type: "anonymous",
      iat: now,
      exp: now + 60 * 60,
    }),
    "frontend-anonymous",
  ].join(".");

  return { user, token };
};

export const isAuthenticated = () => getSessionUser() !== null;

export const subscribeToSession = (callback: () => void) => {
  const listener = () => callback();

  window.addEventListener(SESSION_EVENT, listener);

  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
  };
};
