import { SectionTitles } from "../constants"
import "./about.css"
import { aboutCards } from "./constants"
import { aboutSection } from "../constants"
import { useInView } from "../useInView"
import type { CSSProperties } from "react"

export default function About() {
    const {ref, visible} = useInView<HTMLDivElement>({
        threshold: 0.08,
        rootMargin: "0px 0px -5% 0px",
    });

    return(
        <div className="body__about" id="about" ref={ref}>
            <SectionTitles title={aboutSection.title} description={aboutSection.description}/>
            <div className="about__cards">
                {aboutCards.map((card, index) => (
                    <article
                        className={`about__card ${visible ? "about__card--visible": ""}`}
                        key={card.step}
                        style={{ "--card-index": index } as CSSProperties}
                    >
                        <div className="about__card-step">{card.step}</div>
                        <div className="about__card-icon">{card.icon}</div>
                        <h3 className="about__card-title">{card.title}</h3>
                        <p className="about__card-description">{card.description}</p>
                    </article>
                ))}
            </div>
        </div>
    )
}
