import { Link } from "react-router-dom";
import "./not-found.css";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__card">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">Page Not Found</h1>
        <p className="not-found__text">
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link to="/" className="not-found__btn">
          Return Home
        </Link>
      </div>
    </main>
  );
}
