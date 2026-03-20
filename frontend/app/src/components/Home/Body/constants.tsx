import type { ReactNode } from "react";
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { useInView } from "./useInView";

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
        icon: <PeopleAltIcon />,
        title:'Private Networking',
        description: 'Connect with hand-selected entrepreneurs, investors, and industry leaders in intimate settings.',
    },
    {
        icon: <PeopleAltIcon />,
        title:'Private Networking',
        description: 'Connect with hand-selected entrepreneurs, investors, and industry leaders in intimate settings.',
    },
    {
        icon: <PeopleAltIcon />,
        title:'Private Networking',
        description: 'Connect with hand-selected entrepreneurs, investors, and industry leaders in intimate settings.',
    },
    {
        icon: <PeopleAltIcon />,
        title:'Private Networking',
        description: 'Connect with hand-selected entrepreneurs, investors, and industry leaders in intimate settings.',
    },
] 