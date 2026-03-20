import "./navbar.css"
import "./animations.css"

import { useEffect, useState } from "react"

export default function Navbar({ titles }: { titles: string[] }) {
    const [scrolled, setScrolled] = useState(false);

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
                <h2 className="logo" aria-label="Secret Dinner">
                    <img className="logo__image" src="/logo__1_-removebg-preview.png" alt="Secret Dinner logo" />
                    <span className="logo__text">Secret Dinner</span>
                </h2>
                <div className="titles">
                    {titles.map((title) =>{
                        return <p className="title">{title}</p>
                    })}
                </div>
                <button className="join__btn">Join Now</button>
            </nav>
        </>
    )
}
