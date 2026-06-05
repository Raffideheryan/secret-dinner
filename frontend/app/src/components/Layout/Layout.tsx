import Navbar from "../Navbar/Navbar"
import {Outlet, useLocation} from "react-router-dom"
import { useEffect } from "react";
import { useI18n } from "../../i18n";

export default function Layout() {
    const { t } = useI18n();
    const location = useLocation();
    const items = [
        { label: t("nav.experience"), sectionId: "experience" },
        { label: t("nav.prices"), sectionId: "membership" },
        { label: t("nav.howItWorks"), sectionId: "about" },
    ];

    useEffect(() => {
        if (!location.hash) {
            return;
        }

        const sectionId = location.hash.slice(1);
        const timeoutId = window.setTimeout(() => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [location.hash, location.pathname]);

    return (
        <>
            <Navbar items={items} />
            <main>
                <Outlet />
            </main>

        </>
    )
}
