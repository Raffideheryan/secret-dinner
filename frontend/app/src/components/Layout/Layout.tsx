import Navbar from "../Navbar/Navbar"
import {Outlet} from "react-router-dom"
import { useI18n } from "../../i18n";

export default function Layout() {
    const { t } = useI18n();
    const items = [
        { label: t("nav.experience"), sectionId: "experience" },
        { label: t("nav.prices"), sectionId: "membership" },
        { label: t("nav.howItWorks"), sectionId: "about" },
    ];

    return (
        <>
            <Navbar items={items} />
            <main>
                <Outlet />
            </main>

        </>
    )
}
