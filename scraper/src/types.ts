import { Page } from 'puppeteer';

export interface Team {
    id: string | null;
    name: string | null;
    logo: string | null;
    logoAlt: string | null;
    title: string | null;
}

export interface MatchMetadata {
    matchId: string | null;
    eventId: string | null;
    eventType: string | null;
    region: string | null;
    isLan: boolean;
    isLive: boolean;
    isPinned: boolean;
    stars: number;
    matchTime: string | null;
    unixTime: number | null;
    timeFormat: string | null;
    matchFormat: string | null;
    matchStage: string | null;
    matchUrl: string | null;
    analyticsUrl: string | null;
    team1: Team;
    team2: Team;
}

export interface ParsedMatch extends MatchMetadata {
    eventName: string;
    html: string;
}

export interface ScrapingResult {
    matches: ParsedMatch[];
    timestamp: string;
}

export interface RankedTeam extends Team {
    rank: number;
    points: number;
    change: number;
    isNew: boolean;
}

export interface TeamScrapingResult {
    teams: RankedTeam[];
    timestamp: string;
} 