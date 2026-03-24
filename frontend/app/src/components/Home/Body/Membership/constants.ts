import type { PriceCardProps } from "./types";

export const packageCards: PriceCardProps[] = [
    {
    package: "Silver",
    price: "֏25,000",
    buttonText: "Reserve",
    options: [
      "3-course dinner (starter, main, dessert)",
      "Carefully selected seasonal menu",
      "Shared social atmosphere",
    ],
    },
    {
    package: "Gold",
    price: "֏30,000",
    buttonText: "Reserve",
    options: [
      "4-course dinner (starter, main, dessert + chef’s addition)",
      "Welcome drink included",
      "Better table placement",
      "More curated group setting",
    ],
    },
    {
    package: "VIP",
    price: "֏40,000",
    buttonText: "Reserve",
    featured: true,
    options: [
      "5+ course tasting menu",
      "Welcome drink + wine pairing",
      "Top-tier venue and intimate setting",
      "Highly curated guest list",
    ],
    }
]
