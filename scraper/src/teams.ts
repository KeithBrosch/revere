import puppeteer, { Browser, Page } from 'puppeteer';
import { RankedTeam, TeamScrapingResult } from './types';
import { handleCookieDialog, setupPage } from './utils';
import cron from 'node-cron';

// Configuration object for team scraping
const CONFIG = {
    baseUrl: process.env.HLTV_BASE_URL || 'https://www.hltv.org',
    rankingPath: '/ranking/teams',
    waitTime: parseInt(process.env.SCRAPER_WAIT_TIME || '5000'),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '60000'), // 1 minute
    cronSchedule: '0 0 */24 * * *', // Run every 24 hours at midnight
    get rankingUrl() {
        return `${this.baseUrl}${this.rankingPath}`;
    }
} as const;

// Abstracted browser setup
async function setupBrowser(): Promise<Browser> {
    return await puppeteer.launch({ headless: true });
}

// Main team scraping function
export async function scrapeHLTVTeams(): Promise<TeamScrapingResult> {
    const browser = await setupBrowser();
    const page = await browser.newPage();
    await setupPage(page);
    
    try {
        console.log(`[${new Date().toISOString()}] Starting HLTV team rankings scrape...`);
        
        await page.goto(CONFIG.rankingUrl, { waitUntil: 'networkidle0' });
        await handleCookieDialog(page);
        await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));
        
        const teams = await page.evaluate(() => {
            const teamElements = Array.from(document.querySelectorAll('.ranked-team'));
            return teamElements.map((teamElement, index) => {
                const rank = index + 1;
                const pointsText = teamElement.querySelector('.points')?.textContent?.trim() || '0';
                const points = parseInt(pointsText.replace(' points', '')) || 0;
                
                const changeElement = teamElement.querySelector('.change');
                const changeText = changeElement?.textContent?.trim() || '0';
                const change = parseInt(changeText) || 0;
                const isNew = changeElement?.classList.contains('new') || false;
                
                const teamNameElement = teamElement.querySelector('.teamLine .name');
                const name = teamNameElement?.textContent?.trim() || null;
                
                const logoElement = teamElement.querySelector('.teamLine img.team-logo') as HTMLImageElement;
                const logo = logoElement?.src || null;
                const logoAlt = logoElement?.alt || null;
                const title = logoElement?.title || null;
                
                const teamLinkElement = teamElement.querySelector('.teamLine a[href*="/team/"]');
                const teamId = teamLinkElement?.getAttribute('href')?.split('/').pop() || null;
                
                return {
                    id: teamId,
                    name,
                    logo,
                    logoAlt,
                    title,
                    rank,
                    points,
                    change,
                    isNew
                };
            });
        });

        return {
            teams,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error scraping HLTV team rankings:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Error handling wrapper
export async function runTeamScrapeWithErrorHandling(): Promise<void> {
    let attempts = 0;
    let success = false;

    while (attempts < CONFIG.retryAttempts && !success) {
        try {
            const result = await scrapeHLTVTeams();
            // Log full team data
            console.log('Scraped Team Rankings:');
            console.log(JSON.stringify(result.teams, null, 2));
            console.log(`Successfully scraped ${result.teams.length} team rankings`);
            success = true;
        } catch (error) {
            attempts++;
            console.error(`Attempt ${attempts} failed:`, error);
            
            if (attempts < CONFIG.retryAttempts) {
                console.log(`Retrying in ${CONFIG.retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    }

    if (!success) {
        console.error(`Failed to scrape team rankings after ${CONFIG.retryAttempts} attempts`);
    }
}

// Start the cron job for team rankings
let cronJob: cron.ScheduledTask | null = null;

export function startTeamRankingsCron(): void {
    if (cronJob) {
        cronJob.stop();
    }
    
    cronJob = cron.schedule(CONFIG.cronSchedule, async () => {
        console.log('Running scheduled team rankings scrape...');
        await runTeamScrapeWithErrorHandling();
    });
    
    console.log(`Team rankings scraper scheduled to run ${CONFIG.cronSchedule}`);
} 