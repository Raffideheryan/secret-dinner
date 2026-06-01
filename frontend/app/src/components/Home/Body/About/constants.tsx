import type { ReactNode } from "react";
import SearchIcon from '@mui/icons-material/Search';
import EventSeatIcon from '@mui/icons-material/EventSeat';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import RestaurantIcon from '@mui/icons-material/Restaurant';

export type AboutCard = {
    step: string;
    icon: ReactNode;
    title: string;
    description: string;
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function getAboutCards(t: Translator): AboutCard[] {
  return [
    {
      step: "1",
      icon: <SearchIcon />,
      title: t("home.about.step1.title"),
      description: t("home.about.step1.desc"),
    },
    {
      step: "2",
      icon: <EventSeatIcon />,
      title: t("home.about.step2.title"),
      description: t("home.about.step2.desc"),
    },
    {
      step: "3",
      icon: <ConfirmationNumberIcon />,
      title: t("home.about.step3.title"),
      description: t("home.about.step3.desc"),
    },
    {
      step: "4",
      icon: <RestaurantIcon />,
      title: t("home.about.step4.title"),
      description: t("home.about.step4.desc"),
    },
  ];
}
