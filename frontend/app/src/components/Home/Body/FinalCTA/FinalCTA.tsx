import { useInView } from "../useInView"
import "./final-cta.css"
import { Link } from "react-router-dom"
import { ArrowForwardIcon, QrCode2OutlinedIcon } from "../../../Icons"
import TelegramIcon from "@mui/icons-material/Telegram";
import { useI18n } from "../../../../i18n";


export default function FinalCTA() {
    const { t } = useI18n();
    const { ref, visible } = useInView<HTMLDivElement>({
        threshold: 0.12,
        rootMargin: "0px 0px 18% 0px",
    })

    return (
        <div className={`body__final-cta ${visible ? "body__final-cta--visible" : ""}`} ref={ref}>
            <div className="final-cta__panel">
                <div className="final-cta__aurora final-cta__aurora--left" aria-hidden="true" />
                <div className="final-cta__aurora final-cta__aurora--center" aria-hidden="true" />
                <div className="final-cta__aurora final-cta__aurora--right" aria-hidden="true" />

                <p className="final-cta__badge">
                    <QrCode2OutlinedIcon />
                    <span>{t("home.final.badge")}</span>
                </p>

                <h2 className="final-cta__title">
                    <span className="final-cta__title-main">{t("home.final.title.main")}</span>
                    <span className="final-cta__title-accent">{t("home.final.title.accent")}</span>
                </h2>

                <p className="final-cta__description">
                    {t("home.final.desc")}
                </p>

                <div className="final-cta__line" />

                <div className="final-cta__actions">
                    <Link className="final-cta__button final-cta__button--primary" to="/join">
                    <span>{t("home.final.joinNextDinner")}</span><ArrowForwardIcon /></Link>
                    <Link className="final-cta__button final-cta__button--ghost" to="https://t.me/secret_dinner_bot">
                        <TelegramIcon />
                        <span>{t("home.final.joinTelegram")}</span>
                    </Link>
                </div>

                <ul className="final-cta__trust">
                    <li>{t("home.final.trust.1")}</li>
                    <li>{t("home.final.trust.2")}</li>
                    <li>{t("home.final.trust.3")}</li>
                </ul>
            </div>
        </div>
    )
}
