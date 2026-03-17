import type { ReactNode } from "react";
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

export type ExperienceCard = {
    icon: ReactNode,
    title: string,
    description: string,
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