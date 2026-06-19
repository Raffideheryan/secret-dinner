import "./hero.css";
import "./animation.css";
import { Link } from "react-router-dom"
import { WineBarIcon } from "../../Icons";
import BlinkingParticles from "../../common/BlinkingParticles";
import { useI18n } from "../../../i18n";
import { trackLandingEvent } from "../../../activity/tracker";

export default function Hero() {
  const { t } = useI18n();
  const scrollToExperience = () => {
    const section = document.getElementById("experience")
    section?.scrollIntoView({behavior:"smooth", block: "start"})
  }

  return (
    <section className="hero" id="hero">
      <BlinkingParticles overlayClassName="hero__overlay" particleClassName="hero__particle" />

      <div className="hero__content">
        <div className="hero__mark">
          <WineBarIcon className="wine__cup" style={{ fontSize: 38 }} />
        </div>

        <h1 className="hero__title">
          Secret <span>Dinner</span>
        </h1>

        <p className="hero__subtitle">
          {t("home.hero.subtitle")}
        </p>

        <div className="hero__buttons">
          <Link className="request__btn" to="/join" onClick={() => trackLandingEvent("landing_cta_clicked", { location: "hero", action: "join" })}>{t("home.hero.requestInvitation")}</Link>
          <Link className="experience__btn" to="/" onClick={() => { scrollToExperience(); trackLandingEvent("landing_cta_clicked", { location: "hero", action: "explore" }); }}>{t("home.hero.exploreExperience")}</Link>
        </div>
      </div>
    </section>
  );
}
