import { useInView } from "../useInView"
import "./final-cta.css"
import { Link } from "react-router-dom"
import { ArrowForwardIcon, QrCode2OutlinedIcon } from "../../../Icons"
import TelegramIcon from "@mui/icons-material/Telegram";


export default function FinalCTA() {
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
                    <span>Digital entry via QR code</span>
                </p>

                <h2 className="final-cta__title">
                    <span className="final-cta__title-main">Limited Seats.</span>
                    <span className="final-cta__title-accent">Unlimited Opportunities.</span>
                </h2>

                <p className="final-cta__description">
                    Join an exclusive circle where every conversation could change your trajectory. Applications are
                    reviewed weekly.
                </p>

                <div className="final-cta__line" />

                <div className="final-cta__actions">
                    <Link className="final-cta__button final-cta__button--primary" to="/join">
                    <span>Join Next Dinner</span><ArrowForwardIcon /></Link>
                    <Link className="final-cta__button final-cta__button--ghost" to="https://t.me/secret_dinner_bot">
                        <TelegramIcon />
                        <span>Join on Telegram</span>
                    </Link>
                </div>

                <ul className="final-cta__trust">
                    <li>Verified Members Only</li>
                    <li>Secure Application</li>
                    <li>Immediate Support</li>
                </ul>
            </div>
        </div>
    )
}
