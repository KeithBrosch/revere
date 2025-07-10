import puppeteer, { Browser, Page } from 'puppeteer';
import { MatchMetadata, ParsedMatch, ScrapingResult } from './types';
import { handleCookieDialog, setupPage, SCRAPE_INTERVAL } from './utils';

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
                    const matchBottomElement = matchElement?.querySelector('.match-bottom');
                    const matchLink = matchBottomElement?.querySelector('a.match-info')?.getAttribute('href');
                    const matchUrl = matchLink ? `https://www.hltv.org${matchLink}` : null;
                    
                    const timeElement = matchBottomElement?.querySelector('.match-time');
                    const matchTime = timeElement?.textContent?.trim() || null;
                    const unixTime = timeElement?.getAttribute('data-unix');
                    const timeFormat = timeElement?.getAttribute('data-time-format') || null;
                    
                    const matchMeta = matchBottomElement?.querySelector('.match-meta')?.textContent?.trim() || null;
                    
                    const team1Element = matchBottomElement?.querySelector('.team1');
                    const team2Element = matchBottomElement?.querySelector('.team2');
                    
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
                    
                    const matchStageElement = matchBottomElement?.querySelector('.match-stage');
                    const matchStage = matchStageElement && matchStageElement.className ? matchStageElement.className.replace('match-stage ', '').trim() : null;
                    
                    const analyticsLink = matchBottomElement?.querySelector('.match-analytics-btn')?.getAttribute('href');
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

            const matchWrappers = Array.from(document.querySelectorAll('.match-wrapper'));
            
            const parsedMatches: ParsedMatch[] = [];
            
            // Get all match sections
            const matchSections = Array.from(document.querySelectorAll('.matches-list-section'));
            
            // Get today's date for comparison
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            for (const section of matchSections) {
                // Get the date from the section headline (e.g. "Thursday - 2025-07-10")
                const dateText = section.querySelector('.matches-list-headline')?.textContent?.trim() || '';
                const dateMatch = dateText.match(/(\d{4})-(\d{2})-(\d{2})/);
                
                if (!dateMatch) continue;

                const [_, year, month, day] = dateMatch;
                
                // Create a Date object for this section's date
                const sectionDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                
                // Skip if not today (unless it's near midnight and we're looking at tomorrow)
                const isToday = sectionDate.getTime() === today.getTime();
                const isTomorrowAndNearMidnight = sectionDate.getTime() === tomorrow.getTime() && 
                                                now.getHours() >= 23;
                
                if (!isToday && !isTomorrowAndNearMidnight) continue;

                const sectionMatches = Array.from(section.querySelectorAll('.match-wrapper'));

                for (const wrapper of sectionMatches) {
                    try {
                        const matchData = parseMatchHtml(wrapper);
                        if (matchData) {
                            const eventName = wrapper.closest('.match-day')?.querySelector('.standard-headline')?.textContent?.trim() || '';

                            // Get the time from the match (e.g. "10:00")
                            const timeStr = matchData.matchTime || '00:00';
                            const [hours, minutes] = timeStr.split(':').map(n => parseInt(n));
                            
                            // Create a Date object combining the section date with match time
                            const matchDate = new Date(
                                parseInt(year),
                                parseInt(month) - 1,
                                parseInt(day),
                                hours,
                                minutes
                            );
                            
                            matchData.unixTime = Math.floor(matchDate.getTime() / 1000);

                            parsedMatches.push({
                                ...matchData,
                                eventName,
                                html: wrapper.outerHTML
                            });
                        }
                    } catch (error) {
                        continue;
                    }
                }
            }
            
            return parsedMatches;
        });

        // Get current time and use fixed scrape interval
        const now = Date.now();
        const maxStartTime = now + SCRAPE_INTERVAL;

        // Filter out matches with unknown teams
        const matchesWithTeams = matches.filter(match => 
            match.team1.name && match.team1.name !== 'Unknown' && 
            match.team2.name && match.team2.name !== 'Unknown'
        );

        // Filter based on start time
        const validMatches = matchesWithTeams.filter(match => {
            if (!match.unixTime) return false;
            const startTimeMs = match.unixTime * 1000;
            return startTimeMs > now && startTimeMs <= maxStartTime;
        });

        if (validMatches.length > 0) {
            console.log(`\nThese matches begin in the next ${SCRAPE_INTERVAL / 60000} minutes:`);
            validMatches.forEach(match => {
                const startTime = new Date(match.unixTime! * 1000);
                const minutesUntilStart = Math.round((match.unixTime! * 1000 - now) / 60000);
                console.log(`\n${match.team1.name} vs ${match.team2.name}`);
                console.log(`Starts in: ${minutesUntilStart} minutes (${startTime.toLocaleTimeString()})`);
                console.log(`Event: ${match.eventName}`);
                console.log(`Format: ${match.matchFormat || 'Unknown'}`);
                console.log(`Stage: ${match.matchStage || 'Unknown'}`);
                console.log(`Match URL: ${match.matchUrl || 'Unknown'}`);
                console.log(`Event Type: ${match.eventType || 'Unknown'}`);
                console.log(`Region: ${match.region || 'Unknown'}`);
                console.log(`Stars: ${match.stars}`);
                console.log(`Is Live: ${match.isLive}`);
                console.log(`Is LAN: ${match.isLan}`);
                console.log(`Team 1: ${match.team1.name} (ID: ${match.team1.id})`);
                console.log(`Team 2: ${match.team2.name} (ID: ${match.team2.id})`);
            });
        }

        return {
            matches: validMatches || [],
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Error handling wrapper
export async function runMatchScrapeWithErrorHandling(): Promise<ScrapingResult | null> {
    let attempts = 0;
    let success = false;
    let finalResult: ScrapingResult | null = null;

    while (attempts < CONFIG.retryAttempts && !success) {
        try {
            const result = await scrapeHLTVMatches();
            console.log(`Successfully scraped ${result.matches.length} matches`);
            finalResult = result;
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

    return finalResult;
} 