import { SectionTitles } from "../constants"
import { useInView } from "../useInView"
import type { CSSProperties } from "react"
import "./atmosphere.css"
import { useI18n } from "../../../../i18n"

const atmospherePhotos = [
    { src: "/atmosphere/table.webp", altKey: "home.atmosphere.alt.table", variant: "atmosphere__picture--hero" },
    { src: "/atmosphere/garden.webp", altKey: "home.atmosphere.alt.garden", variant: "atmosphere__picture--tall" },
    { src: "/atmosphere/foods.webp", altKey: "home.atmosphere.alt.foods", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/tableglass.webp", altKey: "home.atmosphere.alt.tableglass", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/sweet.webp", altKey: "home.atmosphere.alt.sweet", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/mix.webp", altKey: "home.atmosphere.alt.mix", variant: "atmosphere__picture--tall" },
    { src: "/atmosphere/sevan.webp", altKey: "home.atmosphere.alt.sevan", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/stake.webp", altKey: "home.atmosphere.alt.steak", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/sweet2.webp", altKey: "home.atmosphere.alt.sweet2", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/hero-bg.webp", altKey: "home.atmosphere.alt.hero", variant: "atmosphere__picture--wide" },
]

export default function Atmosphere() {
    const { t } = useI18n();
    const {ref,visible} = useInView<HTMLDivElement>({
        threshold: 0.12,
        rootMargin: "0px 0px 25% 0px",
    })

    return (
        <div className="body__atmosphere" id="atmosphere" ref={ref}>
            <SectionTitles title={t("home.section.atmosphere.title")} description={t("home.section.atmosphere.desc")}/>
            <div className={`atmosphere__pictures ${visible ? "atmosphere__pictures--visible" : ""}`}>
                {atmospherePhotos.map((photo, index) => (
                    <figure
                        key={photo.src}
                        className={`atmosphere__picture ${photo.variant}`}
                        style={{ "--delay-index": index } as CSSProperties}
                    >
                        <img src={photo.src} alt={t(photo.altKey)} loading="lazy" decoding="async" />
                    </figure>
                ))}
            </div>
        </div>
    )
}
