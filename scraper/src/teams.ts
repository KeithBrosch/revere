import puppeteer, { Browser, Page } from 'puppeteer';
import fetch from 'node-fetch';
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
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    get rankingUrl() {
        return `${this.baseUrl}${this.rankingPath}`;
    }
} as const;

interface BackendResponse {
    success: boolean;
    message: string;
    timestamp?: string;
}

// Abstracted browser setup
async function setupBrowser(): Promise<Browser> {
    return await puppeteer.launch({ headless: true });
}

// Function to send teams to backend API
async function sendTeamsToBackend(result: TeamScrapingResult): Promise<void> {
    try {
        console.log('\n[Teams Scraper] 📤 Sending teams to backend...');
        const response = await fetch(`${CONFIG.backendUrl}/api/teams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(result),
        });

        if (!response.ok) {
            throw new Error(`Backend API responded with status: ${response.status}`);
        }

        const responseData = await response.json() as BackendResponse;
        console.log('[Teams Scraper] ✅ Successfully sent teams to backend:', responseData.message);
    } catch (error) {
        console.error('[Teams Scraper] ❌ Failed to send teams to backend:', error);
        throw error;
    }
}

// Main team scraping function
export async function scrapeHLTVTeams(): Promise<TeamScrapingResult> {
    const browser = await setupBrowser();
    const page = await browser.newPage();
    await setupPage(page);
    
    try {
        console.log('\n[Teams Scraper] 🔍 Starting HLTV team rankings scrape...');
        
        await page.goto(CONFIG.rankingUrl, { waitUntil: 'networkidle0' });
        await handleCookieDialog(page);
        await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));
        
        const teams = await page.evaluate(() => {
            const teamElements = Array.from(document.querySelectorAll('.ranked-team'));
            return teamElements.map((teamElement, index) => {
                const rank = index + 1;
                const pointsText = teamElement.querySelector('.points')?.textContent?.trim() || '0';
                const points = parseInt(pointsText.replace(/[^0-9]/g, '')) || 0;
                
                const changeElement = teamElement.querySelector('.change');
                const changeText = changeElement?.textContent?.trim() || '0';
                const change = parseInt(changeText) || 0;
                const isNew = changeElement?.classList.contains('new') || false;
                
                const teamNameElement = teamElement.querySelector('.teamLine .name');
                const name = teamNameElement?.textContent?.trim() || null;
                
                // Get team ID from the team profile link
                const teamProfileLink = teamElement.querySelector('.more .moreLink[href^="/team/"]');
                const teamId = teamProfileLink?.getAttribute('href')?.split('/')[2] || null;
                
                // Get logo from the team logo image in ranking-header
                const logoElement = teamElement.querySelector('.ranking-header .team-logo img');
                const logo = logoElement?.getAttribute('src') || null;
                const logoAlt = logoElement?.getAttribute('alt') || null;
                const title = logoElement?.getAttribute('title') || null;
                
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

        console.log(`[Teams Scraper] ✅ Successfully scraped ${teams.length} teams`);
        
        return {
            teams,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('[Teams Scraper] ❌ Error scraping HLTV team rankings:', error);
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
            // Send teams to backend
            await sendTeamsToBackend(result);
            success = true;
        } catch (error) {
            attempts++;
            console.error(`[Teams Scraper] ❌ Attempt ${attempts} failed:`, error);
            
            if (attempts < CONFIG.retryAttempts) {
                console.log(`[Teams Scraper] 🔄 Retrying in ${CONFIG.retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
            }
        }
    }

    if (!success) {
        console.error(`[Teams Scraper] ❌ Failed to scrape team rankings after ${CONFIG.retryAttempts} attempts`);
    }
}

// Start the cron job for team rankings
let cronJob: cron.ScheduledTask | null = null;

export function startTeamRankingsCron(): void {
    if (cronJob) {
        cronJob.stop();
    }
    
    cronJob = cron.schedule(CONFIG.cronSchedule, async () => {
        console.log('\n[Teams Scraper] ⏰ Running scheduled team rankings scrape...');
        await runTeamScrapeWithErrorHandling();
    });
    
    console.log(`[Teams Scraper] 📅 Scraper scheduled to run ${CONFIG.cronSchedule}`);
} 