import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

export default function JoinFormGuard({ children }: { children: ReactNode }) {
  const hasCompletedJoinForm = sessionStorage.getItem("joinFormCompleted") === "true";

  if (!hasCompletedJoinForm) {
    return <Navigate to="/join" replace />;
  }

  return <>{children}</>;
}
