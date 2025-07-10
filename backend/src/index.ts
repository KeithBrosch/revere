import express from 'express';
import cors from 'cors';
import { Team, TeamsUpsertRequest, TeamsResponse, SubscriptionResponse, UserSubscriptionsResponse } from './types';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Mock data store
const mockTeams: Team[] = [
  {
    id: '6665',
    name: 'FaZe',
    logo: 'https://img-cdn.hltv.org/teamlogo/SMhzsxzbkIrgqCOYKGqvUJ.svg?ixlib=java-2.1.0&s=e6a9ce0345c7d0329b56039ce1714c84',
    logoAlt: 'FaZe Logo',
    title: 'FaZe',
    rank: 1,
    points: 983,
    change: 0,
    isNew: false
  },
  {
    id: '4608',
    name: 'Vitality',
    logo: 'https://img-cdn.hltv.org/teamlogo/GAlByJtDTnkgbb9p_71SUL.svg?ixlib=java-2.1.0&s=eead8a7cf145f86289c43ec646b51adf',
    logoAlt: 'Vitality Logo',
    title: 'Vitality',
    rank: 2,
    points: 877,
    change: 1,
    isNew: false
  },
  {
    id: '4411',
    name: 'ENCE',
    logo: 'https://img-cdn.hltv.org/teamlogo/kixzGZIb9IYAAv-1vGrGev.svg?ixlib=java-2.1.0&s=8f9986a391fcb1adfbfff021b824a937',
    logoAlt: 'ENCE Logo',
    title: 'ENCE',
    rank: 3,
    points: 705,
    change: -1,
    isNew: false
  },
  {
    id: '11595',
    name: 'Cloud9',
    logo: 'https://img-cdn.hltv.org/teamlogo/JMeLLbWKCIEJrmfPaqOz4O.svg?ixlib=java-2.1.0&s=8b557b5b4571440711ddf75c30a78859',
    logoAlt: 'Cloud9 Logo',
    title: 'Cloud9',
    rank: 4,
    points: 600,
    change: 2,
    isNew: false
  },
  {
    id: '10503',
    name: 'MOUZ',
    logo: 'https://img-cdn.hltv.org/teamlogo/1YWxVoOc_XUTWqyqnGU7Vyy.png?ixlib=java-2.1.0&w=100&s=ddc5952ae5dc65eb9089bf8a7d0ae8bb',
    logoAlt: 'MOUZ Logo',
    title: 'MOUZ',
    rank: 5,
    points: 590,
    change: 0,
    isNew: false
  },
  {
    id: '12398',
    name: 'Spirit',
    logo: null,
    logoAlt: null,
    title: 'Spirit',
    rank: 6,
    points: 450,
    change: 3,
    isNew: true
  }
];

// Mock subscriptions store (in-memory)
const mockSubscriptions = new Set<string>();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Teams upsert endpoint (used by scraper)
app.post('/api/teams', (req, res) => {
    try {
        const { teams, timestamp } = req.body as TeamsUpsertRequest;
        
        // For now, just log the received teams
        console.log('\n[Backend] 📥 Received team data:');
        console.log(`[Backend] ℹ️ Timestamp: ${timestamp}`);
        console.log(`[Backend] ℹ️ Number of teams: ${teams.length}`);
        console.log('[Backend] 📊 First 3 teams:', JSON.stringify(teams.slice(0, 3), null, 2));
        
        res.json({
            success: true,
            message: `Successfully received ${teams.length} teams`,
            timestamp
        });
    } catch (error) {
        console.error('[Backend] ❌ Error processing teams:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing teams',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get teams endpoint
app.get('/api/teams', (req, res) => {
    try {
        const response: TeamsResponse = {
            teams: mockTeams,
            timestamp: new Date().toISOString()
        };
        res.json(response);
    } catch (error) {
        console.error('[Backend] ❌ Error fetching teams:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching teams',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Subscribe to team endpoint
app.post('/api/teams/:teamId/subscribe', (req, res) => {
    try {
        const { teamId } = req.params;
        const team = mockTeams.find(t => t.id === teamId);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found',
                teamId
            } as SubscriptionResponse);
        }

        mockSubscriptions.add(teamId);
        
        const response: SubscriptionResponse = {
            success: true,
            message: `Successfully subscribed to ${team.name}`,
            teamId
        };
        res.json(response);
    } catch (error) {
        console.error('[Backend] ❌ Error subscribing to team:', error);
        res.status(500).json({
            success: false,
            message: 'Error subscribing to team',
            teamId: req.params.teamId
        } as SubscriptionResponse);
    }
});

// Unsubscribe from team endpoint
app.delete('/api/teams/:teamId/subscribe', (req, res) => {
    try {
        const { teamId } = req.params;
        const team = mockTeams.find(t => t.id === teamId);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found',
                teamId
            } as SubscriptionResponse);
        }

        mockSubscriptions.delete(teamId);
        
        const response: SubscriptionResponse = {
            success: true,
            message: `Successfully unsubscribed from ${team.name}`,
            teamId
        };
        res.json(response);
    } catch (error) {
        console.error('[Backend] ❌ Error unsubscribing from team:', error);
        res.status(500).json({
            success: false,
            message: 'Error unsubscribing from team',
            teamId: req.params.teamId
        } as SubscriptionResponse);
    }
});

// Get user subscriptions endpoint
app.get('/api/teams/subscriptions', (req, res) => {
    try {
        const response: UserSubscriptionsResponse = {
            subscribedTeamIds: Array.from(mockSubscriptions)
        };
        res.json(response);
    } catch (error) {
        console.error('[Backend] ❌ Error fetching subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscriptions',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.listen(port, () => {
    console.log(`[Backend] 🚀 Server listening at http://localhost:${port}`);
});
