import { useMemo, type CSSProperties } from "react";

type BlinkingParticlesProps = {
  overlayClassName: string;
  particleClassName: string;
};

export default function BlinkingParticles({
  overlayClassName,
  particleClassName,
}: BlinkingParticlesProps) {
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

  if (particles.length === 0) {
    return null;
  }

  return (
    <div className={overlayClassName}>
      {particles.map((p) => (
        <span
          key={p.id}
          className={particleClassName}
          style={
            {
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
