type PriceCardType = {
    package: string;
    price: string;
    buttonText: string;
    options: string[];
    featured?: boolean;
}

export type PriceCardProps = PriceCardType

export function PriceCard({package:packageName,price,buttonText, options, featured = false}:PriceCardProps ) {
    return (
        <div className={featured ? "price__card price__card--featured" : "price__card"}>
            {featured ? <p className="price__card-badge">Most Popular</p> : null}
            <h2 className="package">{packageName}</h2>
            <p className="price">{price}<span className="price__suffix"> / event</span></p>
            <ul className="options">
                {options.map((opt) => (
                    <li key={opt}>{opt}</li>
                ))}
            </ul>

            <button className="package__btn">{buttonText}</button>
        </div>
    )
}
