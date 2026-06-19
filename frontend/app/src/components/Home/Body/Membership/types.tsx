import { Link } from "react-router-dom";
import { useI18n } from "../../../../i18n";
import { trackLandingEvent } from "../../../../activity/tracker";

type PriceCardType = {
    package: string;
    price: string;
    buttonText: string;
    options: string[];
    featured?: boolean;
}

export type PriceCardProps = PriceCardType

export function PriceCard({package:packageName,price,buttonText, options, featured = false}:PriceCardProps ) {
    const { t } = useI18n();
    return (
        <div className={featured ? "price__card price__card--featured" : "price__card"}>
            {featured ? <p className="price__card-badge">{t("home.membership.mostPopular")}</p> : null}
            <h2 className="package">{packageName}</h2>
            <div className="price" aria-label={`${packageName} price`}>
                <span className="price__prefix">{t("home.membership.from")}</span>
                <span className="price__value">
                    <span className="price__amount">{price}</span>
                    <span className="price__suffix">{t("home.membership.perEvent")}</span>
                </span>
            </div>
            <ul className="options">
                {options.map((opt, index) => (
                    <li key={`${opt}-${index}`}>{opt}</li>
                ))}
            </ul>

            <Link className="package__btn" to="/join" onClick={() => trackLandingEvent("landing_cta_clicked", { location: "membership", package: packageName, action: "join" })}>
                {buttonText}
            </Link>
        </div>
    )
}
