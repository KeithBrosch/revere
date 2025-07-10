// Types shared with the scraper
export interface Team {
  id: string;
  name: string;
  logo: string | null;
  logoAlt: string | null;
  title: string | null;
  rank: number;
  points: number;
  change: number;
  isNew: boolean;
}

export interface TeamsUpsertRequest {
  teams: Team[];
  timestamp: string;
}

export interface TeamsResponse {
  teams: Team[];
  timestamp: string;
}

export interface SubscriptionResponse {
  success: boolean;
  message: string;
  teamId: string;
}

export interface UserSubscriptionsResponse {
  subscribedTeamIds: string[];
} 