import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { apiJson } from "../../api/client";
import {
  getSessionUser,
  isAuthenticated,
  subscribeToSession,
} from "../../auth/session";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const user = useSyncExternalStore(subscribeToSession, getSessionUser);
  const [validatedUserId, setValidatedUserId] = useState<string | null>(null);
  const currentUserId = user ? String(user.id) : null;
  const isSessionValid =
    user?.isAnonymous ||
    (currentUserId !== null && validatedUserId === currentUserId);

  useEffect(() => {
    if (user?.isAnonymous) return undefined;
    if (!currentUserId) return undefined;

    let cancelled = false;

    apiJson("/api/auth/me")
      .then(() => {
        if (!cancelled) {
          setValidatedUserId(currentUserId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setValidatedUserId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, user?.isAnonymous]);

  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!isSessionValid) {
    return null;
  }

  return children;
}
