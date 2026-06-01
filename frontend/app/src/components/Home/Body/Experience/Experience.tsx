import "./experience.css"
import "./animations.css"
import { SectionTitles, type ExperienceCard } from "../constants"
import { useInView } from "../useInView";
import type { CSSProperties } from "react";
import { useI18n } from "../../../../i18n";

type ExperienceProps = {
    cards: ExperienceCard[];
}

function splitLead(text: string): { lead: string; body: string } {
    const clean = text.trim().replace(/\s+/g, " ");
    if (!clean) return { lead: "", body: "" };

    const separators = [". ", "۔ ", "։ ", "! ", "? "];
    let bestIndex = -1;
    let bestSep = "";

    for (const sep of separators) {
        const idx = clean.indexOf(sep);
        if (idx > 0 && (bestIndex === -1 || idx < bestIndex)) {
            bestIndex = idx;
            bestSep = sep;
        }
    }

    if (bestIndex === -1) return { lead: "", body: clean };

    const end = bestIndex + bestSep.length - 1;
    const lead = clean.slice(0, end).trim();
    const body = clean.slice(end).trim();
    return { lead, body };
}

export default function Experience({cards}: ExperienceProps) {
    const { ref, visible } = useInView<HTMLDivElement>();
    const { t } = useI18n();

    return (
        <div className="body__experience" id="experience" ref={ref}>
            <SectionTitles title={t("home.section.experience.title")} description={t("home.section.experience.desc")}/>
            <div className="experience__cards">
                {cards.map((card,index) => (
                    <div
                        className={`experience__card experience__card--tone-${(index % 4) + 1} ${visible ? "experience__card--visible" : ""}`}
                        key={index}
                        style={{ "--card-index": index } as CSSProperties}
                    >
                        <span className="experience__card-index">{String(index + 1).padStart(2, "0")}</span>
                        <div className="experience__card-icon">{card.icon}</div>
                        <h3 className="experience__card-title">{card.title}</h3>
                        {(() => {
                            const parts = splitLead(card.description);
                            return (
                                <>
                                    {parts.lead ? <p className="experience__card-lead">{parts.lead}</p> : null}
                                    <p className="experience__card-description">{parts.body || card.description}</p>
                                </>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    )
}
