import type { ReactNode } from "react";
import { DescriptionOutlinedIcon } from "../../../Icons";

export type AboutCard = {
    step: string;
    icon: ReactNode;
    title: string;
    description: string;
}



export const aboutCards: AboutCard[] = [
    {
        step: "1",
        icon: <DescriptionOutlinedIcon />,
        title: "Apply",
        description: "Submit your application with LinkedIn profile and brief introduction.",
    },
    {
        step: "2",
        icon: <DescriptionOutlinedIcon />,
        title: "Apply",
        description: "Submit your application with LinkedIn profile and brief introduction.",
    },
    {
        step: "3",
        icon: <DescriptionOutlinedIcon />,
        title: "Apply",
        description: "Submit your application with LinkedIn profile and brief introduction.",
    },
    {
        step: "4",
        icon: <DescriptionOutlinedIcon />,
        title: "Apply",
        description: "Submit your application with LinkedIn profile and brief introduction.",
    },
]
