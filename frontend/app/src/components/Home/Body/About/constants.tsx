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



export const aboutCards: AboutCard[] = [
  {
    step: "1",
    icon: <SearchIcon />,
    title: "Explore Dinners",
    description: "Browse upcoming dinners, venues, and available dates.",
  },
  {
    step: "2",
    icon: <EventSeatIcon />,
    title: "Reserve Your Spot",
    description: "Book your seat individually or with friends in just a few taps.",
  },
  {
    step: "3",
    icon: <ConfirmationNumberIcon />,
    title: "Get Confirmation",
    description: "Receive your reservation details and everything you need before the event.",
  },
  {
    step: "4",
    icon: <RestaurantIcon />,
    title: "Enjoy the Experience",
    description: "Arrive, dine, and enjoy the atmosphere—everything else is taken care of.",
  }

]
