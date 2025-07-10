import { runMatchScrapeWithErrorHandling } from './matches';

console.log('Testing matches scraper...');
runMatchScrapeWithErrorHandling()
    .then(() => {
        console.log('Matches scraper test complete');
        process.exit(0);
    })
    .catch(error => {
        console.error('Matches scraper test failed:', error);
        process.exit(1);
    }); 