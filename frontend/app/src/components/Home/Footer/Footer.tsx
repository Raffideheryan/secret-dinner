import "./footer.css"
import { InstagramIcon, MailOutlineIcon, TelegramIcon } from "../../Icons"

const quickLinks = ["About", "Atmosphere", "Membership", "Contact"]
const legalLinks = ["Privacy Policy", "Terms of Service", "Cookie Policy"]
const sectionIdByQuickLink: Record<string, string> = {
    About: "about",
    Atmosphere: "atmosphere",
    Membership: "membership",
    Contact: "hero",
}

export default function Footer() {

    const scrollToSection =(sectionID: string) =>{
        const section = document.getElementById(sectionID);
        if (!section) {
            if (sectionID === "hero") {
                window.scrollTo({top: 0, behavior: "smooth"})
            };
            return;
        }
        section.scrollIntoView({behavior:"smooth", block:"start"});
    };

    return (
        <footer className="home__footer">
            <div className="footer__inner">
                <div className="footer__top">
                    <div className="footer__brand">
                        <div className="footer__brand-head">
                            <img className="footer__logo-mark" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                            <h3 className="footer__logo-title">
                                <span>Secret</span>
                                <span>Dinner</span>
                            </h3>
                        </div>
                        <p className="footer__description">
                            An exclusive platform connecting elite entrepreneurs, investors, and visionaries through
                            curated dining experiences.
                        </p>

                        <div className="footer__socials">
                            <a className="footer__social" href="#" aria-label="Instagram">
                                <InstagramIcon />
                            </a>
                            <a className="footer__social" href="#" aria-label="Telegram">
                                <TelegramIcon />
                            </a>
                            <a className="footer__social" href="#" aria-label="Email">
                                <MailOutlineIcon />
                            </a>
                        </div>
                    </div>

                    <div className="footer__column">
                        <h4 className="footer__heading">Quick Links</h4>
                        <ul className="footer__list">
                            {quickLinks.map((link) => (
                                <li key={link}>
                                    <a
                                        href="#"
                                        onClick={(event) => {
                                            event.preventDefault()
                                            const sectionID = sectionIdByQuickLink[link]
                                            if (sectionID) {
                                                scrollToSection(sectionID)
                                            }
                                        }}
                                    >
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="footer__column">
                        <h4 className="footer__heading">Legal</h4>
                        <ul className="footer__list">
                            {legalLinks.map((link) => (
                                <li key={link}>
                                    <a href="#">{link}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <p>© 2026 Secret Dinner. All rights reserved.</p>
                    <p>Made with exclusivity in mind</p>
                </div>
            </div>
        </footer>
    )
}
