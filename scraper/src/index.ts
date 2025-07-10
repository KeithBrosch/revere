import { runMatchScrapeWithErrorHandling } from './matches';
import { runTeamScrapeWithErrorHandling } from './teams';
import { calculatePollingInterval, TEAM_SCRAPE_INTERVAL } from './utils';

async function runMatchScraper() {
    try {
        await runMatchScrapeWithErrorHandling();
        // Schedule next match scrape using the normal polling interval
        const interval = calculatePollingInterval();
        setTimeout(runMatchScraper, interval);
    } catch (error) {
        console.error('Error in match scraper:', error);
        // On error, retry after 1 minute
        setTimeout(runMatchScraper, 60 * 1000);
    }
}

async function runTeamScraper() {
    try {
        console.log(`[${new Date().toISOString()}] Running team scraper...`);
        await runTeamScrapeWithErrorHandling();
        // Schedule next team scrape in 24 hours
        console.log(`[${new Date().toISOString()}] Scheduling next team scrape in ${TEAM_SCRAPE_INTERVAL / (1000 * 60 * 60)} hours`);
        setTimeout(runTeamScraper, TEAM_SCRAPE_INTERVAL);
    } catch (error) {
        console.error('Error in team scraper:', error);
        // On error, retry after 5 minutes
        setTimeout(runTeamScraper, 5 * 60 * 1000);
    }
}

// Start both scrapers immediately
async function main() {
    console.log('Starting initial scrapes...');
    try {
        // Run both scrapers immediately
        await Promise.all([
            runMatchScrapeWithErrorHandling(),
            runTeamScrapeWithErrorHandling()
        ]);
        console.log('Initial scrapes completed');

        // Set up separate intervals for each scraper
        runMatchScraper(); // Will schedule itself for next run
        runTeamScraper();  // Will schedule itself for next run
    } catch (error) {
        console.error('Error in initial scrapes:', error);
        // If initial scrapes fail, retry after 1 minute
        setTimeout(main, 60 * 1000);
    }
}

// Start the scraping loops
main();
