import cron from 'node-cron';
import dotenv from 'dotenv';
import { runMatchScrapeWithErrorHandling } from './matches';
import { runTeamScrapeWithErrorHandling, startTeamRankingsCron } from './teams';
import { calculatePollingInterval, POLLING_INTERVALS } from './utils';
import { ParsedMatch, ScrapingResult } from './types';

// Load environment variables
dotenv.config();

// Scraper state
let lastRunTime: Date | null = null;
let consecutiveFailures = 0;
let isRunning = false;
let matchTimeout: NodeJS.Timeout | null = null;
let lastScrapedMatches: ParsedMatch[] = [];

// Health status check
function getHealthStatus(): void {
    const now = new Date();
    const lastRun = lastRunTime ? `${Math.round((now.getTime() - lastRunTime.getTime()) / 1000 / 60)} minutes ago` : 'never';
    const nextPollInterval = lastScrapedMatches.length > 0 ? 
        Math.round(calculatePollingInterval(lastScrapedMatches) / 1000 / 60) : 
        Math.round(POLLING_INTERVALS.DEFAULT / 1000 / 60);
    
    console.log({
        status: isRunning ? 'running' : 'idle',
        lastRun,
        consecutiveFailures,
        isHealthy: consecutiveFailures < 3,
        nextPollIn: `${nextPollInterval} minutes`
    });
}

// Schedule next match scrape
async function scheduleNextMatchScrape(): Promise<void> {
    if (matchTimeout) {
        clearTimeout(matchTimeout);
    }

    const interval = calculatePollingInterval(lastScrapedMatches);
    console.log(`Scheduling next match scrape in ${Math.round(interval / 1000 / 60)} minutes`);

    matchTimeout = setTimeout(async () => {
        try {
            const result = await runMatchScrapeWithErrorHandling();
            if (result?.matches) {
                lastScrapedMatches = result.matches;
                consecutiveFailures = 0;
            } else {
                consecutiveFailures++;
            }
            lastRunTime = new Date();
        } catch (error) {
            console.error('Error in scheduled match scrape:', error);
            consecutiveFailures++;
        } finally {
            isRunning = false;
            await scheduleNextMatchScrape();
        }
    }, interval);
}

// Manual trigger
async function triggerManualRun(): Promise<void> {
    if (isRunning) {
        console.log('Scraper is already running');
        return;
    }
    
    console.log('Manually triggering scrape...');
    isRunning = true;
    try {
        const result = await runMatchScrapeWithErrorHandling();
        if (result?.matches) {
            lastScrapedMatches = result.matches;
            consecutiveFailures = 0;
        } else {
            consecutiveFailures++;
        }
        lastRunTime = new Date();
    } catch (error) {
        console.error('Error in manual scrape:', error);
        consecutiveFailures++;
    } finally {
        isRunning = false;
        await scheduleNextMatchScrape();
    }
}

// Start both scrapers
async function startScrapers(): Promise<void> {
    console.log('Starting scrapers...');
    
    // Run both scrapers immediately
    console.log('Running initial scrapes...');
    try {
        const [matchResult, teamResult] = await Promise.all([
            runMatchScrapeWithErrorHandling(),
            runTeamScrapeWithErrorHandling()
        ]);
        
        if (matchResult?.matches) {
            lastScrapedMatches = matchResult.matches;
        }
        
        console.log('Initial scrapes completed successfully');
    } catch (error) {
        console.error('Error during initial scrapes:', error);
    }
    
    // Set up scheduled runs
    await scheduleNextMatchScrape();
    startTeamRankingsCron();
    
    console.log('Both scrapers started and scheduled successfully');
}

// Cleanup function
function cleanup(): void {
    if (matchTimeout) {
        clearTimeout(matchTimeout);
    }
}

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

export {
    getHealthStatus,
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
