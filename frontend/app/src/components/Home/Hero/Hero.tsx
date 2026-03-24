import "./hero.css";
import "./animation.css";
import { Link } from "react-router-dom"
import { WineBarIcon } from "../../Icons";
import BlinkingParticles from "../../common/BlinkingParticles";

export default function Hero() {
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
          Where connections become opportunities
        </p>

        <div className="hero__buttons">
          <Link className="request__btn" to="/join">Request Invitation</Link>
          <Link className="experience__btn" to="/" onClick={scrollToExperience}>Explore Experience</Link>  
        </div>
      </div>
    </section>
  );
}
