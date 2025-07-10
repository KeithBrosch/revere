import { Page } from 'puppeteer';
import { ParsedMatch } from './types';

// Scraping intervals in milliseconds
export const SCRAPE_INTERVAL = 5 * 60 * 1000;   // 5 minutes
export const TEAM_SCRAPE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
export const JITTER_MAX = 5 * 1000;             // 5 seconds max random jitter

/**
 * Handles the cookie consent dialog that appears on HLTV pages
 * Attempts to find and click the accept button using various selectors
 */
export async function handleCookieDialog(page: Page): Promise<void> {
    const COOKIE_DIALOG_TIMEOUT = parseInt(process.env.COOKIE_DIALOG_TIMEOUT || '5000');
    const DIALOG_DISAPPEAR_TIMEOUT = parseInt(process.env.DIALOG_DISAPPEAR_TIMEOUT || '10000');

    try {
        await page.waitForSelector('#CybotCookiebotDialog', { timeout: COOKIE_DIALOG_TIMEOUT });
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
        }, { timeout: DIALOG_DISAPPEAR_TIMEOUT });
        
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
 * Calculates the polling interval, adding random jitter to avoid predictable patterns
 * @returns Interval in milliseconds, including random jitter
 */
export function calculatePollingInterval(): number {
    const now = Date.now();
    
    // Check if we're approaching midnight
    const timeUntilMidnight = getTimeUntilNextMidnight();
    if (timeUntilMidnight < SCRAPE_INTERVAL) {
        // If we're close to midnight, wait until 1 minute after midnight
        console.log('Scheduling midnight scrape to catch new matches');
        return timeUntilMidnight;
    }
    
    // Add jitter to make scraping patterns less predictable
    const jitter = Math.random() * JITTER_MAX;
    return SCRAPE_INTERVAL + jitter;
} 