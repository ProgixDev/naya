import { chromium, DRV, PH, post, newPage, helpers, signIn } from './lib.mjs';
const log = [];
await post('/dev/reset', { scenario: 'default' });
const browser = await chromium.launch();
const dp = await newPage(browser, 'dark'); const D = helpers(dp, 'driver-dark', log);
await signIn(dp, DRV, 'driver', PH.amina);
await D.step('wallet', async () => { await D.go(DRV, '/wallet', 3000); await D.S('D4-wallet'); });
await D.step('earnings', async () => { await D.go(DRV, '/earnings', 3000); await D.S('D6-earnings'); });
await browser.close();
