import { SectionTitles } from "../constants"
import { useInView } from "../useInView"
import type { CSSProperties } from "react"
import "./atmosphere.css"

const atmospherePhotos = [
    { src: "/atmosphere/table.webp", alt: "Guests gathered around a candle-lit table", variant: "atmosphere__picture--hero" },
    { src: "/atmosphere/garden.webp", alt: "Outdoor garden dinner scene", variant: "atmosphere__picture--tall" },
    { src: "/atmosphere/foods.webp", alt: "Plated tasting menu dishes", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/tableglass.webp", alt: "Glasses and reflections on dinner table", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/sweet.webp", alt: "Dessert course prepared for service", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/mix.webp", alt: "Chef finishing plates before serving", variant: "atmosphere__picture--tall" },
    { src: "/atmosphere/sevan.webp", alt: "Scenic evening location atmosphere", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/stake.webp", alt: "Signature steak dish presentation", variant: "atmosphere__picture--wide" },
    { src: "/atmosphere/sweet2.webp", alt: "Dessert plating close-up", variant: "atmosphere__picture--square" },
    { src: "/atmosphere/hero-bg.webp", alt: "Ambient dinner table lighting", variant: "atmosphere__picture--wide" },
]

export default function Atmosphere() {
    const {ref,visible} = useInView<HTMLDivElement>({
        threshold: 0.12,
        rootMargin: "0px 0px 25% 0px",
    })

    return (
        <div className="body__atmosphere" id="atmosphere" ref={ref}>
            <SectionTitles title="The Atmosphere" description="A glimpse into evenings where memories and opportunities are made"/>
            <div className={`atmosphere__pictures ${visible ? "atmosphere__pictures--visible" : ""}`}>
                {atmospherePhotos.map((photo, index) => (
                    <figure
                        key={photo.src}
                        className={`atmosphere__picture ${photo.variant}`}
                        style={{ "--delay-index": index } as CSSProperties}
                    >
                        <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
                    </figure>
                ))}
            </div>
        </div>
    )
}
