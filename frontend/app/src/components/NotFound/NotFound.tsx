import { Link } from "react-router-dom";
import "./not-found.css";
import { useI18n } from "../../i18n";
import SeoHead from "../SEO/SeoHead";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="not-found">
      <SeoHead
        title="Page Not Found"
        description="The requested Secret Dinner page could not be found."
        noindex
      />
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
