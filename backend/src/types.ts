// Types shared with the scraper
export interface Team {
    id: string | null;
    name: string | null;
    logo: string | null;
    logoAlt: string | null;
    title: string | null;
}

export interface RankedTeam extends Team {
    rank: number;
    points: number;
    change: number;
    isNew: boolean;
}

// API specific types
export interface TeamsUpsertRequest {
    teams: RankedTeam[];
    timestamp: string;
} 