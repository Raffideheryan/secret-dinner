import "./navbar.css"
import "./animations.css"
import { Link } from "react-router-dom"

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useI18n, type Language } from "../../i18n";

type NavItem = { label: string; sectionId: string };

const languages: Array<{ code: Language; labelKey: "lang.english" | "lang.russian" | "lang.armenian" }> = [
    { code: "en", labelKey: "lang.english" },
    { code: "ru", labelKey: "lang.russian" },
    { code: "hy", labelKey: "lang.armenian" },
];

export default function Navbar({ items }: { items: NavItem[] }) {
    const [scrolled, setScrolled] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const langMenuRef = useRef<HTMLDivElement | null>(null);
    const { lang, setLang, t } = useI18n();

    const currentLangLabel = useMemo(() => {
        const entry = languages.find((l) => l.code === lang);
        return entry ? t(entry.labelKey) : t("lang.english");
    }, [lang, t]);

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
        scrollToSection(title);
    };

    useEffect(() =>{
        const handleScroll = () =>{
            setScrolled(window.scrollY > 40);
        };
        handleScroll();
        window.addEventListener("scroll",handleScroll)

        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (!langOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (target && langMenuRef.current && !langMenuRef.current.contains(target)) {
                setLangOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setLangOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [langOpen]);

    return (
        <>
            <nav className= {`navbar ${scrolled ? "navbar--scrolled" : ""}`} >
                <a className="logo" href="#hero" aria-label="Secret Dinner" onClick={handleLogoClick}>
                    <img className="logo__image" src="/logo__1_-removebg-preview.webp" alt="Secret Dinner logo" />
                    <span className="logo__text">Secret Dinner</span>
                </a>
                <div className="titles">
                    {items.map((item) =>{
                        return (
                            <button className="title" key={item.sectionId} type="button" onClick={() => handleTitleClick(item.sectionId)}>
                                {item.label}
                            </button>
                        );
                    })}
                </div>
                <div className="navbar__actions">
                    <div className="navbar__lang" ref={langMenuRef}>
                        <button
                            className="navbar__lang-btn"
                            type="button"
                            aria-label={t("nav.language")}
                            aria-haspopup="menu"
                            aria-expanded={langOpen}
                            onClick={() => setLangOpen((v) => !v)}
                        >
                            <span className="navbar__lang-code">{lang.toUpperCase()}</span>
                            <span className="navbar__lang-caret" aria-hidden="true">▾</span>
                        </button>
                        {langOpen ? (
                            <div className="navbar__lang-menu" role="menu" aria-label={t("nav.language")}>
                                <div className="navbar__lang-current">{currentLangLabel}</div>
                                {languages.map((l) => (
                                    <button
                                        key={l.code}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={lang === l.code}
                                        className={lang === l.code ? "navbar__lang-item navbar__lang-item--active" : "navbar__lang-item"}
                                        onClick={() => {
                                            setLang(l.code);
                                            setLangOpen(false);
                                        }}
                                    >
                                        <span className="navbar__lang-item-code">{l.code.toUpperCase()}</span>
                                        <span className="navbar__lang-item-label">{t(l.labelKey)}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <Link className="navbar__join-btn" to="/join">{t("nav.joinNow")}</Link>
                </div>
            </nav>
        </>
    )
}
