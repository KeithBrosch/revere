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

interface TeamsResponse {
  teams: Team[];
  timestamp: string;
}

interface SubscriptionResponse {
  success: boolean;
  message: string;
  teamId: string;
}

interface UserSubscriptionsResponse {
  subscribedTeamIds: string[];
}

const API_BASE_URL = 'http://localhost:3000/api';

// API functions
export const teamsApi = {
  // Get all teams
  getTeams: async (): Promise<Team[]> => {
    const response = await fetch(`${API_BASE_URL}/teams`);
    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.statusText}`);
    }
    const data: TeamsResponse = await response.json();
    return data.teams;
  },

  // Subscribe to a team
  subscribeToTeam: async (teamId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/teams/${teamId}/subscribe`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to subscribe to team: ${response.statusText}`);
    }
    const data: SubscriptionResponse = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
  },

  // Unsubscribe from a team
  unsubscribeFromTeam: async (teamId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/teams/${teamId}/subscribe`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to unsubscribe from team: ${response.statusText}`);
    }
    const data: SubscriptionResponse = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
  },

  // Get user's subscribed teams
  getSubscribedTeams: async (): Promise<string[]> => {
    const response = await fetch(`${API_BASE_URL}/teams/subscriptions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
    }
    const data: UserSubscriptionsResponse = await response.json();
    return data.subscribedTeamIds;
  }
}; 