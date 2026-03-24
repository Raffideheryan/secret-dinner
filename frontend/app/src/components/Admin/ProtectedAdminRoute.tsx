import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { adminMe } from "../../admin/api";

export default function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      try {
        await adminMe();
        if (active) {
          setAuthorized(true);
        }
      } catch {
        if (active) {
          setAuthorized(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p style={{ padding: "2rem", textAlign: "center" }}>Checking session...</p>;
  }

  if (!authorized) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
