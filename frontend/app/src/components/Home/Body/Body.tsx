import Experience from "./Experience/Experience"
import About from "./About/About"
import { cards } from "./constants"
import "./body.css"

export default function Body() {
    return (
        <>
            <section className="home__body">
                <Experience cards={cards}/>
                <About />
            </section>
        </>
    )
}
