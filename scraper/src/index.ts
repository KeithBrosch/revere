import puppeteer, { Browser, Page } from 'puppeteer';
import cron from 'node-cron';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// TypeScript interfaces for better type safety
interface Team {
    id: string | null;
    name: string | null;
    logo: string | null;
    logoAlt: string | null;
    title: string | null;
}

interface MatchMetadata {
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

interface ParsedMatch extends MatchMetadata {
    eventName: string;
    html: string;
}

interface ScrapingResult {
    matches: ParsedMatch[];
    timestamp: string;
}

// Configuration object for better maintainability
const CONFIG = {
    baseUrl: process.env.HLTV_BASE_URL || 'https://www.hltv.org',
    matchesPath: '/matches',
    userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    waitTime: parseInt(process.env.SCRAPER_WAIT_TIME || '5000'),
    cookieDialogTimeout: parseInt(process.env.COOKIE_DIALOG_TIMEOUT || '5000'),
    dialogDisappearTimeout: parseInt(process.env.DIALOG_DISAPPEAR_TIMEOUT || '10000'),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '60000'), // 1 minute
    cronSchedule: process.env.CRON_SCHEDULE || '*/30 * * * *', // Every 30 minutes by default
    get matchesUrl() {
        return `${this.baseUrl}${this.matchesPath}`;
    },
    getFullUrl(path: string): string {
        return `${this.baseUrl}${path}`;
    }
} as const;

// Health monitoring
let lastRunTime: Date | null = null;
let consecutiveFailures = 0;
let isRunning = false;
let cronJob: cron.ScheduledTask | null = null;

// Abstracted browser setup
async function setupBrowser(): Promise<Browser> {
    return await puppeteer.launch({ headless: true });
}

// Abstracted page setup
async function setupPage(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setUserAgent(CONFIG.userAgent);
    return page;
}

// Abstracted cookie handling
async function handleCookieDialog(page: Page): Promise<void> {
    try {
        await page.waitForSelector('#CybotCookiebotDialog', { timeout: CONFIG.cookieDialogTimeout });
        console.log('Handling cookie dialog...');
        
        const acceptButton = await page.$('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
        if (acceptButton) {
            await acceptButton.click();
        } else {
            const alternativeButton = await page.$('button[data-testid="accept-cookies"]') || 
                                   await page.$('.CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll') ||
                                   await page.$('[aria-label*="Accept"]');
            if (alternativeButton) {
                await alternativeButton.click();
            }
        }
        
        await page.waitForFunction(() => {
            const dialog = document.querySelector('#CybotCookiebotDialog') as HTMLElement;
            return !dialog || dialog.style.display === 'none';
        }, { timeout: CONFIG.dialogDisappearTimeout });
        
    } catch (error) {
        // Cookie dialog not found or already handled
    }
}

// Abstracted match parsing function
function parseMatchHtml(matchWrapper: Element): MatchMetadata | null {
    try {
        const matchId = matchWrapper.getAttribute('data-match-id');
        const eventId = matchWrapper.getAttribute('data-event-id');
        const eventType = matchWrapper.getAttribute('data-eventtype');
        const region = matchWrapper.getAttribute('data-region');
        const isLan = matchWrapper.getAttribute('lan') === 'true';
        const isLive = matchWrapper.getAttribute('live') === 'true';
        const team1Id = matchWrapper.getAttribute('team1');
        const team2Id = matchWrapper.getAttribute('team2');
        const isPinned = matchWrapper.getAttribute('data-pinned') === 'true';
        const stars = parseInt(matchWrapper.getAttribute('data-stars') || '0');
        
        const matchElement = matchWrapper.querySelector('.match');
        const matchLink = matchElement?.querySelector('a[href*="/matches/"]')?.getAttribute('href');
        const matchUrl = matchLink ? CONFIG.getFullUrl(matchLink) : null;
        
        const timeElement = matchElement?.querySelector('.match-time');
        const matchTime = timeElement?.textContent?.trim() || null;
        const unixTime = timeElement?.getAttribute('data-unix');
        const timeFormat = timeElement?.getAttribute('data-time-format') || null;
        
        const matchMeta = matchElement?.querySelector('.match-meta')?.textContent?.trim() || null;
        
        const team1Element = matchElement?.querySelector('.team1');
        const team2Element = matchElement?.querySelector('.team2');
        
        const team1: Team = {
            id: team1Id,
            name: team1Element?.querySelector('.match-teamname')?.textContent?.trim() || null,
            logo: team1Element?.querySelector('.match-team-logo')?.getAttribute('src') || null,
            logoAlt: team1Element?.querySelector('.match-team-logo')?.getAttribute('alt') || null,
            title: team1Element?.querySelector('.match-team-logo')?.getAttribute('title') || null
        };
        
        const team2: Team = {
            id: team2Id,
            name: team2Element?.querySelector('.match-teamname')?.textContent?.trim() || null,
            logo: team2Element?.querySelector('.match-team-logo')?.getAttribute('src') || null,
            logoAlt: team2Element?.querySelector('.match-team-logo')?.getAttribute('alt') || null,
            title: team2Element?.querySelector('.match-team-logo')?.getAttribute('title') || null
        };
        
        const matchStageElement = matchElement?.querySelector('.match-stage');
        const matchStage = matchStageElement && matchStageElement.className ? matchStageElement.className.replace('match-stage ', '').trim() : null;
        
        const analyticsLink = matchElement?.querySelector('.match-analytics-btn')?.getAttribute('href');
        const analyticsUrl = analyticsLink ? CONFIG.getFullUrl(analyticsLink) : null;
        
        return {
            matchId,
            eventId,
            eventType,
            region,
            isLan,
            isLive,
            isPinned,
            stars,
            matchTime,
            unixTime: unixTime ? parseInt(unixTime) : null,
            timeFormat,
            matchFormat: matchMeta,
            matchStage,
            matchUrl,
            analyticsUrl,
            team1,
            team2
        };
    } catch (error) {
        console.error('Error parsing match HTML:', error);
        return null;
    }
}

// Main scraping function
async function scrapeHLTVMatches(): Promise<ScrapingResult> {
    const browser = await setupBrowser();
    const page = await setupPage(browser);
    
    try {
        console.log(`[${new Date().toISOString()}] Starting HLTV scrape...`);
        
        await page.goto(CONFIG.matchesUrl, { waitUntil: 'networkidle0' });
        await handleCookieDialog(page);
        await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));
        
        const matches = await page.evaluate(() => {
            // Function to parse match HTML and extract metadata (defined inside browser context)
            function parseMatchHtml(matchWrapper: Element) {
                try {
                    const matchId = matchWrapper.getAttribute('data-match-id');
                    const eventId = matchWrapper.getAttribute('data-event-id');
                    const eventType = matchWrapper.getAttribute('data-eventtype');
                    const region = matchWrapper.getAttribute('data-region');
                    const isLan = matchWrapper.getAttribute('lan') === 'true';
                    const isLive = matchWrapper.getAttribute('live') === 'true';
                    const team1Id = matchWrapper.getAttribute('team1');
                    const team2Id = matchWrapper.getAttribute('team2');
                    const isPinned = matchWrapper.getAttribute('data-pinned') === 'true';
                    const stars = parseInt(matchWrapper.getAttribute('data-stars') || '0');
                    
                    const matchElement = matchWrapper.querySelector('.match');
                    const matchLink = matchElement?.querySelector('a[href*="/matches/"]')?.getAttribute('href');
                    const matchUrl = matchLink ? `https://www.hltv.org${matchLink}` : null;
                    
                    const timeElement = matchElement?.querySelector('.match-time');
                    const matchTime = timeElement?.textContent?.trim() || null;
                    const unixTime = timeElement?.getAttribute('data-unix');
                    const timeFormat = timeElement?.getAttribute('data-time-format') || null;
                    
                    const matchMeta = matchElement?.querySelector('.match-meta')?.textContent?.trim() || null;
                    
                    const team1Element = matchElement?.querySelector('.team1');
                    const team2Element = matchElement?.querySelector('.team2');
                    
                    const team1 = {
                        id: team1Id,
                        name: team1Element?.querySelector('.match-teamname')?.textContent?.trim() || null,
                        logo: team1Element?.querySelector('.match-team-logo')?.getAttribute('src') || null,
                        logoAlt: team1Element?.querySelector('.match-team-logo')?.getAttribute('alt') || null,
                        title: team1Element?.querySelector('.match-team-logo')?.getAttribute('title') || null
                    };
                    
                    const team2 = {
                        id: team2Id,
                        name: team2Element?.querySelector('.match-teamname')?.textContent?.trim() || null,
                        logo: team2Element?.querySelector('.match-team-logo')?.getAttribute('src') || null,
                        logoAlt: team2Element?.querySelector('.match-team-logo')?.getAttribute('alt') || null,
                        title: team2Element?.querySelector('.match-team-logo')?.getAttribute('title') || null
                    };
                    
                    const matchStageElement = matchElement?.querySelector('.match-stage');
                    const matchStage = matchStageElement && matchStageElement.className ? matchStageElement.className.replace('match-stage ', '').trim() : null;
                    
                    const analyticsLink = matchElement?.querySelector('.match-analytics-btn')?.getAttribute('href');
                    const analyticsUrl = analyticsLink ? `https://www.hltv.org${analyticsLink}` : null;
                    
                    return {
                        matchId,
                        eventId,
                        eventType,
                        region,
                        isLan,
                        isLive,
                        isPinned,
                        stars,
                        matchTime,
                        unixTime: unixTime ? parseInt(unixTime) : null,
                        timeFormat,
                        matchFormat: matchMeta,
                        matchStage,
                        matchUrl,
                        analyticsUrl,
                        team1,
                        team2
                    };
                } catch (error) {
                    console.error('Error parsing match HTML:', error);
                    return null;
                }
            }
            
            const matchData: any[] = [];
            
            const allMatchesEventsLists = document.querySelectorAll('.matches-events-list');
            
            allMatchesEventsLists.forEach((matchesList) => {
                const eventWrappers = matchesList.querySelectorAll('.matches-event-wrapper');
                
                eventWrappers.forEach((eventWrapper) => {
                    const matchesList = eventWrapper.querySelector('.matches-list');
                    if (matchesList) {
                        const matchWrappers = matchesList.querySelectorAll('.match-wrapper');
                        
                        matchWrappers.forEach((matchWrapper) => {
                            const eventName = eventWrapper.querySelector('.event-name')?.textContent?.trim() || 'Unknown Event';
                            
                            // Parse the match HTML and extract metadata
                            const metadata = parseMatchHtml(matchWrapper);
                            
                            if (metadata && metadata.team1.name && metadata.team2.name) {
                                matchData.push({
                                    ...metadata,
                                    eventName,
                                    html: matchWrapper.outerHTML
                                });
                            }
                        });
                    }
                });
            });
            
            return matchData;
        });
        
        const result: ScrapingResult = {
            matches,
            timestamp: new Date().toISOString()
        };
        
        console.log(`[${result.timestamp}] Found ${matches.length} matches`);
        
        if (matches.length > 0) {
            console.log('Match details:');
            matches.forEach((match, index) => {
                console.log(`Match ${index + 1}: ${match.team1.name} vs ${match.team2.name} (${match.matchTime})`);
            });
        } else {
            console.log('No matches found at this time.');
        }
        
        return result;
        
    } finally {
        await browser.close();
    }
}

// Error handling wrapper with health monitoring
async function runScrapeWithErrorHandling(): Promise<void> {
    if (isRunning) {
        console.log('Scrape already running, skipping...');
        return;
    }
    
    isRunning = true;
    const startTime = new Date();
    
    try {
        await scrapeHLTVMatches();
        lastRunTime = new Date();
        consecutiveFailures = 0;
        console.log(`[${new Date().toISOString()}] Scrape completed successfully`);
    } catch (error) {
        consecutiveFailures++;
        console.error(`[${new Date().toISOString()}] Scraping failed (attempt ${consecutiveFailures}):`, error);
        
        // If we have too many consecutive failures, restart the cron job
        if (consecutiveFailures >= 3) {
            console.error('Too many consecutive failures, restarting cron job...');
            restartCronJob();
        }
    } finally {
        isRunning = false;
    }
}

// Health check function
function getHealthStatus(): void {
    const now = new Date();
    const timeSinceLastRun = lastRunTime ? now.getTime() - lastRunTime.getTime() : null;
    const minutesSinceLastRun = timeSinceLastRun ? Math.floor(timeSinceLastRun / (1000 * 60)) : null;
    
    console.log('=== Health Status ===');
    console.log(`Cron job running: ${cronJob ? 'Yes' : 'No'}`);
    console.log(`Currently running: ${isRunning ? 'Yes' : 'No'}`);
    console.log(`Last run: ${lastRunTime ? lastRunTime.toISOString() : 'Never'}`);
    console.log(`Minutes since last run: ${minutesSinceLastRun !== null ? minutesSinceLastRun : 'N/A'}`);
    console.log(`Consecutive failures: ${consecutiveFailures}`);
    console.log('====================');
}

// Restart cron job function
function restartCronJob(): void {
    if (cronJob) {
        cronJob.stop();
        console.log('Stopped existing cron job');
    }
    
    cronJob = cron.schedule('*/5 * * * *', runScrapeWithErrorHandling);
    console.log('Restarted cron job');
    consecutiveFailures = 0;
}

// Manual trigger function
function triggerManualRun(): void {
    console.log('Manual trigger requested...');
    runScrapeWithErrorHandling();
}

// Initialize the scraper
console.log('Starting HLTV match scraper - monitoring every 5 minutes');

// Schedule the scraper
cronJob = cron.schedule('*/5 * * * *', runScrapeWithErrorHandling);

// Run initial scrape
runScrapeWithErrorHandling()
    .then(() => console.log('Initial scrape completed'))
    .catch(error => console.error('Initial scrape failed:', error));

// Export functions for manual control
export { triggerManualRun, getHealthStatus, restartCronJob };
