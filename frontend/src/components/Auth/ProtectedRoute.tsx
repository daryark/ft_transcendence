import { Navigate, useLocation } from "react-router-dom";
import { useSyncExternalStore, type ReactNode } from "react";
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
  useSyncExternalStore(subscribeToSession, getSessionUser);

  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
