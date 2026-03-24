import type { ReactNode } from "react";
import { useInView } from "./useInView";
import RestaurantIcon from '@mui/icons-material/Restaurant';
import GroupsIcon from '@mui/icons-material/Groups';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ForumIcon from '@mui/icons-material/Forum';

export type ExperienceCard = {
    icon: ReactNode,
    title: string,
    description: string,
}

export type Section ={
    title: string;
    description: string;
} 

export const aboutSection: Section = {
    title :"How It Works",
    description: "Four simple steps to enter an exclusive world",
}

export const membershipSection: Section = {
    title : "Membership Tiers",
    description: "Choose your level of exclusivity",
}


export function SectionTitles({title,description}: Section) {
    const {ref, visible} = useInView<HTMLDivElement>();
    
    return(
        <div
        ref={ref}
        className={`sections__title ${visible ? "sections__title--visible" : ""} `}>
            <h2 className="section__title">{title}</h2>
            <p className="section__description">{description}</p>
        </div>
    )
}

export const cards:  ExperienceCard[] = [
  {
    icon: <RestaurantIcon />,
    title: 'Refined Dining',
    description: 'Enjoy a premium dinner experience in carefully selected venues with exceptional food and atmosphere.',
  },
  {
    icon: <GroupsIcon />,
    title: 'Come As You Are',
    description: 'Join with your partner, friends, or on your own—just like any great night out.',
  },
  {
    icon: <AutoAwesomeIcon />,
    title: 'Thoughtful Crowd',
    description: 'Dine among a curated mix of interesting people, without the pressure of formal networking.',
  },
  {
    icon: <ForumIcon />,
    title: 'Natural Connections',
    description: 'Conversations happen organically in a relaxed, restaurant-style setting.',
  }
]
