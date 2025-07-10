import cron from 'node-cron';
import dotenv from 'dotenv';
import { runMatchScrapeWithErrorHandling } from './matches';
import { runTeamScrapeWithErrorHandling, startTeamRankingsCron } from './teams';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
    matchCronSchedule: process.env.MATCH_CRON_SCHEDULE || '*/30 * * * *', // Every 30 minutes by default
} as const;

// Health monitoring
let lastRunTime: Date | null = null;
let consecutiveFailures = 0;
let isRunning = false;
let matchCronJob: cron.ScheduledTask | null = null;

// Health status check
function getHealthStatus(): void {
    const now = new Date();
    const lastRun = lastRunTime ? `${Math.round((now.getTime() - lastRunTime.getTime()) / 1000 / 60)} minutes ago` : 'never';
    
    console.log({
        status: isRunning ? 'running' : 'idle',
        lastRun,
        consecutiveFailures,
        isHealthy: consecutiveFailures < 3
    });
}

// Restart cron job
function restartMatchCronJob(): void {
    if (matchCronJob) {
        matchCronJob.stop();
    }
    
    matchCronJob = cron.schedule(CONFIG.matchCronSchedule, async () => {
        console.log('Running scheduled match scrape...');
        await runMatchScrapeWithErrorHandling();
    });
    
    console.log(`Match scraper scheduled to run ${CONFIG.matchCronSchedule}`);
}

// Manual trigger
async function triggerManualRun(): Promise<void> {
    if (isRunning) {
        console.log('Scraper is already running');
        return;
    }
    
    console.log('Manually triggering scrape...');
    await runMatchScrapeWithErrorHandling();
}

// Start both scrapers
async function startScrapers(): Promise<void> {
    console.log('Starting scrapers...');
    
    // Run both scrapers immediately
    console.log('Running initial scrapes...');
    try {
        await Promise.all([
            runMatchScrapeWithErrorHandling(),
            runTeamScrapeWithErrorHandling()
        ]);
        console.log('Initial scrapes completed successfully');
    } catch (error) {
        console.error('Error during initial scrapes:', error);
    }
    
    // Set up scheduled runs
    console.log('Setting up scheduled runs...');
    restartMatchCronJob();
    startTeamRankingsCron();
    
    console.log('Both scrapers started and scheduled successfully');
}

// Export functions for external use
export {
    getHealthStatus,
    restartMatchCronJob,
    triggerManualRun,
    startScrapers
};

// Start scrapers when this file is run directly
if (require.main === module) {
    startScrapers().catch(error => {
        console.error('Failed to start scrapers:', error);
        process.exit(1);
    });
}
