import { Page } from 'puppeteer';

// Configuration for utility functions
const UTILS_CONFIG = {
    cookieDialogTimeout: parseInt(process.env.COOKIE_DIALOG_TIMEOUT || '5000'),
    dialogDisappearTimeout: parseInt(process.env.DIALOG_DISAPPEAR_TIMEOUT || '10000'),
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