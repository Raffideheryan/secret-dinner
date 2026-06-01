import "./footer.css"
import { InstagramIcon, MailOutlineIcon } from "../../Icons"
import TelegramIcon from "@mui/icons-material/Telegram";
import { useI18n } from "../../../i18n";

type QuickLink = { label: string; sectionId: string };
type LegalLink = { label: string };

export default function Footer() {
    const { t } = useI18n();

    const quickLinks: QuickLink[] = [
        { label: t("footer.link.about"), sectionId: "about" },
        { label: t("footer.link.atmosphere"), sectionId: "atmosphere" },
        { label: t("footer.link.membership"), sectionId: "membership" },
        { label: t("footer.link.contact"), sectionId: "hero" },
    ];

    const legalLinks: LegalLink[] = [
        { label: t("footer.legal.privacy") },
        { label: t("footer.legal.terms") },
        { label: t("footer.legal.cookies") },
    ];

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
                            {t("footer.desc")}
                        </p>

                        <div className="footer__socials">
                            <a className="footer__social" href="https://www.instagram.com/secret_dinner_yvn" aria-label="Instagram">
                                <InstagramIcon />
                            </a>
                            <a className="footer__social" href="https://t.me/secret_dinner_bot" aria-label="Telegram">
                                <TelegramIcon />
                            </a>
                            <a className="footer__social" href="mailto:secretdinnerr@gmail.com" aria-label="Email">
                                <MailOutlineIcon />
                            </a>
                        </div>
                    </div>

                    <div className="footer__column">
                        <h4 className="footer__heading">{t("footer.quickLinks")}</h4>
                        <ul className="footer__list">
                            {quickLinks.map((link) => (
                                <li key={link.sectionId}>
                                    <a
                                        href="#"
                                        onClick={(event) => {
                                            event.preventDefault()
                                            scrollToSection(link.sectionId)
                                        }}
                                    >
                                        {link.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="footer__column">
                        <h4 className="footer__heading">{t("footer.legal")}</h4>
                        <ul className="footer__list">
                            {legalLinks.map((link) => (
                                <li key={link.label}>
                                    <a href="#">{link.label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <p>{t("footer.bottom.rights")}</p>
                    <p>{t("footer.bottom.tagline")}</p>
                </div>
            </div>
        </footer>
    )
}
