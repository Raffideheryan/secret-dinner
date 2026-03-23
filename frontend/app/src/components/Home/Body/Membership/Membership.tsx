import { SectionTitles } from "../constants";
import { membershipSection } from "../constants";
import { PriceCard } from "./types";
import { packageCards } from "./constants";
import "./membership.css";
import "./animations.css"
import { useInView } from "../useInView";

export default function Membership(){

    const {ref, visible} = useInView<HTMLDivElement>()
    return(
        <div className={`body__membership ${visible ? "body__membership--visible" : ""}`} id="membership" ref={ref}>
            <SectionTitles title={membershipSection.title} description={membershipSection.description}/>
            <div className="price__cards">
                {packageCards.map((card) => (
                    <PriceCard
                        key={card.package}
                        package={card.package}
                        price={card.price}
                        buttonText={card.buttonText}
                        options={card.options}
                        featured={card.featured}
                    />
                ))}
            </div>
        </div>
    )
}
