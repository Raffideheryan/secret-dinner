import type { PriceCardProps } from "./types";

export const packageCards: PriceCardProps[] = [
    {
        package: "Silver",
        price: "֏25,000",
        buttonText: "Select Silver",
        options: [
            "Curated guest network access",
            "Priority dinner invitations",
            "Private member introductions",
        ],
    },
    {
        package: "Gold",
        price: "֏30,000",
        buttonText: "Select Gold",
        options: [
            "VIP seating at every event",
            "Founder roundtable access",
            "Premium concierge support",
            "Premium concierge support",
            "Premium concierge support",
            "Premium concierge support",

        ],
    },
    {
        package: "Black",
        price: "֏40,000",
        buttonText: "Apply for Black",
        featured: true,
        options: [
            "Invitation-only flagship dinners",
            "Private host introductions",
            "Full white-glove membership service",
        ],
    },
]
