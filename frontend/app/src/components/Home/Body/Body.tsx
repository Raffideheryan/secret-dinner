import Experience from "./Experience/Experience"
import About from "./About/About"
import Atmosphere from "./Atmosphere/Atmosphere"
import Membership from "./Membership/Membership"
import FinalCTA from "./FinalCTA/FinalCTA"
import { getExperienceCards } from "./constants"
import "./body.css"
import { useI18n } from "../../../i18n"

export default function Body() {
    const { t } = useI18n();
    return (
        <>
            <section className="home__body">
                <Experience cards={getExperienceCards(t)}/>
                <About />
                <Atmosphere />
                <Membership />
                <FinalCTA />
            </section>
        </>
    )
}
