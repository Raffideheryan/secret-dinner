import { useMemo } from "react";
import "./hero.css";
import "./animation.css";

import WineBarIcon from "@mui/icons-material/WineBar";

export default function Hero() {
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        size: Math.random() * 8 + 4,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: Math.random() * 2 + 5,
        delay: Math.random() * 5,
      })),
    []
  );

  return (
    <section className="hero">
      <div className="hero__overlay">
        {particles.map((p) => (
          <span
            key={p.id}
            className="hero__particle"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

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
          <button className="request__btn">Request Invitation</button>
          <button className="experience__btn">Explore Experience</button>
        </div>
      </div>
    </section>
  );
}