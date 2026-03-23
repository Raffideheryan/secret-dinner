import { useMemo } from "react";
import "./hero.css";
import "./animation.css";

import { WineBarIcon } from "../../Icons";

export default function Hero() {
  const particleCount = useMemo(() => {
    if (typeof window === "undefined") {
      return 14;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return 0;
    }

    if (window.innerWidth <= 480) {
      return 8;
    }

    if (window.innerWidth <= 768) {
      return 14;
    }

    return 20;
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        size: Math.random() * 7 + 3,
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: Math.random() * 2 + 5,
        delay: Math.random() * 5,
      })),
    [particleCount]
  );

  return (
    <section className="hero" id="hero">
      {particles.length > 0 && (
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
      )}

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
          <button className="request__btn" type="button">Request Invitation</button>
          <button className="experience__btn" type="button">Explore Experience</button>
        </div>
      </div>
    </section>
  );
}
