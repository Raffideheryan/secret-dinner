import "./footer.css"
import { InstagramIcon, LinkedInIcon, MailOutlineIcon, XIcon } from "../../Icons"

const quickLinks = ["About", "Events", "Membership", "Contact"]
const legalLinks = ["Privacy Policy", "Terms of Service", "Cookie Policy"]

export default function Footer() {
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
                            <a className="footer__social" href="#" aria-label="LinkedIn">
                                <LinkedInIcon />
                            </a>
                            <a className="footer__social" href="#" aria-label="X">
                                <XIcon />
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
                                    <a href="#">{link}</a>
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
