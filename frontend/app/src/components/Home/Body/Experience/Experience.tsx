import "./experience.css"
import type { ExperienceCard } from "../constants"

type ExperienceProps = {
    cards: ExperienceCard[];
}

export default function Experience({cards}: ExperienceProps) {
    return (
        <div className="body__experience">
            <h2 className="experience__title">The Experience</h2>
            <p className="experience__description">A table reserved for those who move differently.</p>
            <div className="experience__cards">
                {cards.map((card,index) => (
                    <div className="experience__card" key={index}>
                        <div className="experience__card-icon">{card.icon}</div>
                        <h3 className="experience__card-title">{card.title}</h3>
                        <p className="experience__card-description">{card.description}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}