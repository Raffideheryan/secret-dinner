import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import TelegramIcon from "@mui/icons-material/Telegram"
import { useInView } from "../useInView"
import "./final-cta.css"

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
                    <button className="final-cta__button final-cta__button--primary" type="button">
                        <span>Join Next Dinner</span>
                        <ArrowForwardIcon />
                    </button>
                    <button className="final-cta__button final-cta__button--ghost" type="button">
                        <TelegramIcon />
                        <span>Join on Telegram</span>
                    </button>
                </div>

                <ul className="final-cta__trust">
                    <li>Verified Members Only</li>
                    <li>Secure Application</li>
                    <li>48h Response Time</li>
                </ul>
            </div>
        </div>
    )
}
