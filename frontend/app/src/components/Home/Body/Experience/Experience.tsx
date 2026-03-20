import "./experience.css"
import "./animations.css"
import { SectionTitles, type ExperienceCard } from "../constants"
import { useInView } from "../useInView";
import type { CSSProperties } from "react";

type ExperienceProps = {
    cards: ExperienceCard[];
}

export default function Experience({cards}: ExperienceProps) {
    const { ref, visible } = useInView<HTMLDivElement>();

    return (
        <div className="body__experience" ref={ref}>
            <SectionTitles title="The Experience" description="A table reserved for those who move differently."/>
            <div className="experience__cards">
                {cards.map((card,index) => (
                    <div
                        className={`experience__card ${visible ? "experience__card--visible" : ""}`}
                        key={index}
                        style={{ "--card-index": index } as CSSProperties}
                    >
                        <div className="experience__card-icon">{card.icon}</div>
                        <h3 className="experience__card-title">{card.title}</h3>
                        <p className="experience__card-description">{card.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
