export type JoinForm = {
    fullName: string;
    email: string;
    phone: string;
    guestCount: string;
    hobbies: string;
    allergies?: string;
}

export type JoinPayload = {
    fullName: string;
    email: string;
    phone: string;
    guestCount: number;
    hobbies: string[];
    allergies: string[];
}

export type JoinResponse = {
    success: boolean;
    userId: string;
}

export type PackageTier = "silver" | "gold" | "vip" | "custom";

export type JoinSelectionPayload = {
    userId: string;
    dinnerId: number;
    chosenPackage: PackageTier;
}

export type Dinner = {
    id: number;
    description: string;
    location: string;
    dinnerDate: string;
    places?: number;
    alreadyRegistered?: number;
    silverPrice: number | null;
    goldPrice: number | null;
    vipPrice: number | null;
};
