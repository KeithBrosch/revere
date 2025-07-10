import puppeteer, { Browser, Page } from 'puppeteer';
import { MatchMetadata, ParsedMatch, ScrapingResult } from './types';
import { handleCookieDialog, setupPage } from './utils';

// Configuration object for better maintainability
const CONFIG = {
    baseUrl: process.env.HLTV_BASE_URL || 'https://www.hltv.org',
    matchesPath: '/matches',
    waitTime: parseInt(process.env.SCRAPER_WAIT_TIME || '5000'),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '60000'), // 1 minute
    get matchesUrl() {
        return `${this.baseUrl}${this.matchesPath}`;
    },
    getFullUrl(path: string): string {
        return `${this.baseUrl}${path}`;
    }
} as const;

// Abstracted browser setup
async function setupBrowser(): Promise<Browser> {
    return await puppeteer.launch({ headless: true });
}

// Main scraping function
export async function scrapeHLTVMatches(): Promise<ScrapingResult> {
    const browser = await setupBrowser();
    const page = await browser.newPage();
    await setupPage(page);
    
    try {
        console.log(`[${new Date().toISOString()}] Starting HLTV matches scrape...`);
        
        await page.goto(CONFIG.matchesUrl, { waitUntil: 'networkidle0' });
        await handleCookieDialog(page);
        await new Promise(resolve => setTimeout(resolve, CONFIG.waitTime));
        
        const matches = await page.evaluate(() => {
            // Function to parse match HTML and extract metadata (defined inside browser context)
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

            const matchWrappers = Array.from(document.querySelectorAll('.liveMatch-container, .upcomingMatch'));
            const parsedMatches: ParsedMatch[] = [];
            
            for (const wrapper of matchWrappers) {
                const matchData = parseMatchHtml(wrapper);
                if (matchData) {
                    const eventName = wrapper.closest('.match-day')?.querySelector('.standard-headline')?.textContent?.trim() || '';
                    parsedMatches.push({
                        ...matchData,
                        eventName,
                        html: wrapper.outerHTML
                    });
                }
            }
            
            return parsedMatches;
        });

        return {
            matches,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error scraping HLTV matches:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Error handling wrapper
export async function runMatchScrapeWithErrorHandling(): Promise<void> {
    let attempts = 0;
    let success = false;

    while (attempts < CONFIG.retryAttempts && !success) {
        try {
            const result = await scrapeHLTVMatches();
            // Here you would typically save or process the result
            console.log(`Successfully scraped ${result.matches.length} matches`);
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
        console.error(`Failed to scrape matches after ${CONFIG.retryAttempts} attempts`);
    }
} 