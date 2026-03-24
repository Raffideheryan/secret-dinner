import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../../admin/api";
import "./admin.css";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await adminLogin(username.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-auth">
      <form className="admin-auth__card" onSubmit={handleSubmit}>
        <h1 className="admin-auth__title">Admin Login</h1>
        <p className="admin-auth__subtitle">Sign in to access the admin panel.</p>

        <label className="admin-auth__label" htmlFor="admin-username">
          Username
        </label>
        <input
          id="admin-username"
          className="admin-auth__input"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label className="admin-auth__label" htmlFor="admin-password">
          Password
        </label>
        <input
          id="admin-password"
          className="admin-auth__input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error ? <p className="admin-auth__error">{error}</p> : null}

        <button className="admin-auth__submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </section>
  );
}
