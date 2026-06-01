import { Link } from "react-router-dom";
import "./not-found.css";
import { useI18n } from "../../i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="not-found">
      <div className="not-found__card">
        <p className="not-found__code">404</p>
        <h1 className="not-found__title">{t("notFound.title")}</h1>
        <p className="not-found__text">
          {t("notFound.desc")}
        </p>
        <Link to="/" className="not-found__btn">
          {t("notFound.cta")}
        </Link>
      </div>
    </main>
  );
}
