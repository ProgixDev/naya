import { chromium, PAX, PH, post, get, newPage, helpers, signIn } from './lib.mjs';
const log = [];
await post('/dev/reset', { scenario: 'default' });
await post('/dev/bot', { online: false });
const browser = await chromium.launch();
const pp = await newPage(browser, process.env.SCHEME ?? 'light'); const P = helpers(pp, process.env.SCHEME === 'dark' ? 'passenger-dark' : 'passenger', log);
const tp = await signIn(pp, PAX, 'passenger', PH.salma);
const fam = await post('/dev/family/play', { driver: true, parent: null }, tp.token);
const id = fam.body?.id;
for (let i = 0; i < 40; i++) { const f = await get('/family', tp.token); const t = (f?.trips ?? []).find((x) => x.id === id); if (t?.status === 'awaiting_approval') break; await pp.waitForTimeout(1000); }
await P.step('home', async () => { await P.go(PAX, '/', 4000); await P.S('17b-home-approval-banner'); console.log(await P.ids()); });
await P.step('wallet', async () => { await P.go(PAX, '/wallet', 3000); await P.S('11f-wallet-approval-banner'); });
await P.step('trip', async () => { await P.go(PAX, `/family/${id}`, 3000); await P.S('18f-famille-trip-awaiting-approval'); console.log(await P.ids()); });
await P.step('famhome', async () => { await P.go(PAX, `/family`, 3000); await P.S('12e-famille-home-approval'); });
console.log(JSON.stringify(log.filter((l) => l.error)), pp.__errors.slice(0, 3));
await browser.close();
