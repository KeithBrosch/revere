import express from 'express';
import { TeamsUpsertRequest } from './types';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Teams upsert endpoint
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

app.listen(port, () => {
    console.log(`[Backend] 🚀 Server listening at http://localhost:${port}`);
});
