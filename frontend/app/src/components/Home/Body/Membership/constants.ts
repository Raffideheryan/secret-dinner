import type { PriceCardProps } from "./types";

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function getPackageCards(t: Translator): PriceCardProps[] {
  return [
    {
      package: t("home.membership.tier.silver"),
      price: "֏25,000",
      buttonText: t("home.membership.reserve"),
      options: [
        t("home.membership.option.silver.1"),
        t("home.membership.option.silver.2"),
        t("home.membership.option.silver.3"),
      ],
    },
    {
      package: t("home.membership.tier.gold"),
      price: "֏30,000",
      buttonText: t("home.membership.reserve"),
      options: [
        t("home.membership.option.gold.1"),
        t("home.membership.option.gold.2"),
        t("home.membership.option.gold.3"),
        t("home.membership.option.gold.4"),
      ],
    },
    {
      package: t("home.membership.tier.vip"),
      price: "֏40,000",
      buttonText: t("home.membership.reserve"),
      featured: true,
      options: [
        t("home.membership.option.vip.1"),
        t("home.membership.option.vip.2"),
        t("home.membership.option.vip.3"),
        t("home.membership.option.vip.4"),
      ],
    },
  ];
}
