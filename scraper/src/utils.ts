import { Page } from 'puppeteer';
import { ParsedMatch } from './types';

// Configuration for utility functions
const UTILS_CONFIG = {
    cookieDialogTimeout: parseInt(process.env.COOKIE_DIALOG_TIMEOUT || '5000'),
    dialogDisappearTimeout: parseInt(process.env.DIALOG_DISAPPEAR_TIMEOUT || '10000'),
} as const;

// Constants for polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
    DEFAULT: 15 * 60 * 1000,      // 15 minutes
    UPCOMING: 10 * 60 * 1000,     // 10 minutes
    IMMINENT: 5 * 60 * 1000,      // 5 minutes
    JITTER_MAX: 30 * 1000,        // 30 seconds max random jitter
    MIDNIGHT_OFFSET: 60 * 1000    // 1 minute after midnight
} as const;

// Constants for time thresholds (in milliseconds)
export const TIME_THRESHOLDS = {
    IMMINENT: 30 * 60 * 1000,     // 30 minutes
    UPCOMING: 2 * 60 * 60 * 1000  // 2 hours
} as const;

/**
 * Handles the cookie consent dialog that appears on HLTV pages
 * Attempts to find and click the accept button using various selectors
 */
export async function handleCookieDialog(page: Page): Promise<void> {
    try {
        await page.waitForSelector('#CybotCookiebotDialog', { timeout: UTILS_CONFIG.cookieDialogTimeout });
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
        }, { timeout: UTILS_CONFIG.dialogDisappearTimeout });
        
    } catch (error) {
        // Cookie dialog not found or already handled
        console.log('Cookie dialog not found or already handled');
    }
}

/**
 * Sets up a browser page with common configurations
 */
export async function setupPage(page: Page): Promise<void> {
    const userAgent = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);
    
    // Add additional common page setup here if needed
    // For example:
    // - Setting viewport
    // - Setting request interception
    // - Adding common request headers
} 

/**
 * Calculate time until next midnight plus offset
 * @returns Milliseconds until next midnight plus offset
 */
function getTimeUntilNextMidnight(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0); // Set to 00:01:00
    return tomorrow.getTime() - now.getTime();
}

/**
 * Calculates the appropriate polling interval based on upcoming matches
 * @param matches Array of parsed matches
 * @returns Polling interval in milliseconds, including random jitter
 */
export function calculatePollingInterval(matches: ParsedMatch[]): number {
    const now = Date.now();
    
    // Check if we're approaching midnight
    const timeUntilMidnight = getTimeUntilNextMidnight();
    if (timeUntilMidnight < POLLING_INTERVALS.DEFAULT) {
        // If we're close to midnight, wait until 1 minute after midnight
        console.log('Scheduling midnight scrape to catch new matches');
        return timeUntilMidnight;
    }
    
    // Find soonest upcoming match time
    const soonestMatchTime = matches
        .filter(m => !m.isLive) // Only consider non-live matches
        .map(m => m.unixTime)
        .filter((time): time is number => time !== null && time > now)
        .sort((a, b) => a - b)[0];
    
    // If no upcoming matches, use default interval
    if (!soonestMatchTime) {
        return addJitter(POLLING_INTERVALS.DEFAULT);
    }
    
    const timeUntilMatch = soonestMatchTime - now;
    
    // Determine base interval based on how soon the next match is
    let baseInterval = POLLING_INTERVALS.DEFAULT;
    if (timeUntilMatch < TIME_THRESHOLDS.IMMINENT) {
        baseInterval = POLLING_INTERVALS.IMMINENT;
    } else if (timeUntilMatch < TIME_THRESHOLDS.UPCOMING) {
        baseInterval = POLLING_INTERVALS.UPCOMING;
    }
    
    // Don't add jitter to midnight scrapes
    return timeUntilMidnight < POLLING_INTERVALS.DEFAULT ? 
        timeUntilMidnight : 
        addJitter(baseInterval);
}

/**
 * Adds random jitter to a base interval to make scraping patterns less predictable
 * @param baseInterval Base interval in milliseconds
 * @returns Interval with added random jitter
 */
function addJitter(baseInterval: number): number {
    const jitter = Math.random() * POLLING_INTERVALS.JITTER_MAX;
    return baseInterval + jitter;
} 