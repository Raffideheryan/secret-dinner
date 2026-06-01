import { SectionTitles } from "../constants";
import { PriceCard } from "./types";
import { getPackageCards } from "./constants";
import "./membership.css";
import "./animations.css"
import { useInView } from "../useInView";
import { useI18n } from "../../../../i18n";
import { getMembershipSection } from "../constants";

export default function Membership(){
    const { t } = useI18n();
    const membershipSection = getMembershipSection(t);

    const {ref, visible} = useInView<HTMLDivElement>()
    return(
        <div className={`body__membership ${visible ? "body__membership--visible" : ""}`} id="membership" ref={ref}>
            <SectionTitles title={membershipSection.title} description={membershipSection.description}/>
            <div className="price__cards">
                {getPackageCards(t).map((card) => (
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
