import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogout, getAdminPanel, type AdminPanelResponse } from "../../admin/api";
import "./admin.css";

export default function AdminPanel() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await getAdminPanel();
        if (active) {
          setData(response);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "failed to load panel");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await adminLogout();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel__card">
        <div className="admin-panel__header">
          <h1>Admin Panel</h1>
          <button className="admin-panel__logout" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>

        {loading ? <p>Loading...</p> : null}
        {error ? <p className="admin-auth__error">{error}</p> : null}

        {data && !loading ? (
          <div className="admin-panel__stats">
            <article className="admin-stat">
              <p className="admin-stat__label">Panel Name</p>
              <p className="admin-stat__value">{data.name}</p>
            </article>
            <article className="admin-stat">
              <p className="admin-stat__label">Landing Users</p>
              <p className="admin-stat__value">{data.landingUsersCount}</p>
            </article>
          </div>
        ) : null}
      </div>
    </section>
  );
}
