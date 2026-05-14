export type SessionUser = {
  id: number;
  email: string;
  username: string;
  created_at: string | null;
  isAnonymous?: boolean;
};

const SESSION_EVENT = "tetra-session-change";
let currentUser: SessionUser | null = null;

export const getSessionUser = (): SessionUser | null => currentUser;

export const saveSessionUser = (user: SessionUser) => {
  currentUser = user;
  window.dispatchEvent(new Event(SESSION_EVENT));
};

export const createAnonymousUser = (): SessionUser => ({
  id: Date.now(),
  email: "anonymous@local",
  username: `GUEST-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
  created_at: new Date().toISOString(),
  isAnonymous: true,
});

export const isAuthenticated = () => getSessionUser() !== null;

export const subscribeToSession = (callback: () => void) => {
  const listener = () => callback();

  window.addEventListener(SESSION_EVENT, listener);

  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
  };
};
