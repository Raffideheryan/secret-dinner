import Experience from "./Experience/Experience"
import About from "./About/About"
import Atmosphere from "./Atmosphere/Atmosphere"
import Membership from "./Membership/Membership"
import { cards } from "./constants"
import "./body.css"

export default function Body() {
    return (
        <>
            <section className="home__body">
                <Experience cards={cards}/>
                <About />
                <Atmosphere />
                <Membership />
            </section>
        </>
    )
}
