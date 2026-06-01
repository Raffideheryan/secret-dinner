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

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function getAboutSection(t: Translator): Section {
    return {
        title: t("home.section.howItWorks.title"),
        description: t("home.section.howItWorks.desc"),
    };
}

export function getMembershipSection(t: Translator): Section {
    return {
        title: t("home.section.membership.title"),
        description: t("home.section.membership.desc"),
    };
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

export function getExperienceCards(t: Translator): ExperienceCard[] {
  return [
    {
      icon: <RestaurantIcon />,
      title: t("home.experience.card1.title"),
      description: t("home.experience.card1.desc"),
    },
    {
      icon: <GroupsIcon />,
      title: t("home.experience.card2.title"),
      description: t("home.experience.card2.desc"),
    },
    {
      icon: <AutoAwesomeIcon />,
      title: t("home.experience.card3.title"),
      description: t("home.experience.card3.desc"),
    },
    {
      icon: <ForumIcon />,
      title: t("home.experience.card4.title"),
      description: t("home.experience.card4.desc"),
    },
  ];
}
