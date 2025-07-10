import { runTeamScrapeWithErrorHandling } from './teams';

console.log('Testing teams scraper...');
runTeamScrapeWithErrorHandling()
    .then(() => {
        console.log('Teams scraper test complete');
        process.exit(0);
    })
    .catch(error => {
        console.error('Teams scraper test failed:', error);
        process.exit(1);
    }); 