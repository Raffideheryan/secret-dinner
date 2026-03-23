import "./navbar.css"
import "./animations.css"

import { useEffect, useState, type MouseEvent } from "react"

const sectionIdByTitle: Record<string, string> = {
    "Experience": "experience",
    "Prices": "membership",
    "Tiers": "membership",
    "How It Works": "about",
};

export default function Navbar({ titles }: { titles: string[] }) {
    const [scrolled, setScrolled] = useState(false);

    const scrollToSection = (sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (!section) {
            if (sectionId === "hero") {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            return;
        }
        section.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        scrollToSection("hero");
    };

    const handleTitleClick = (title: string) => {
        const sectionId = sectionIdByTitle[title];
        if (!sectionId) {
            return;
        }
        scrollToSection(sectionId);
    };

    useEffect(() =>{
        const handleScroll = () =>{
            setScrolled(window.scrollY > 40);
        };
        handleScroll();
        window.addEventListener("scroll",handleScroll)

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <nav className= {`navbar ${scrolled ? "navbar--scrolled" : ""}`} >
                <a className="logo" href="#hero" aria-label="Secret Dinner" onClick={handleLogoClick}>
                    <img className="logo__image" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    <span className="logo__text">Secret Dinner</span>
                </a>
                <div className="titles">
                    {titles.map((title) =>{
                        return (
                            <button className="title" key={title} type="button" onClick={() => handleTitleClick(title)}>
                                {title}
                            </button>
                        );
                    })}
                </div>
                <button className="join__btn">Join Now</button>
            </nav>
        </>
    )
}
