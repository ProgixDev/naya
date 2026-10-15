import { chromium, PAX, DRV } from './lib.mjs';
const b = await chromium.launch();
for (const u of [PAX, DRV]) { const p = await b.newPage(); const t0 = Date.now(); await p.goto(u, { timeout: 600000 }); await p.waitForSelector('[data-testid]', { timeout: 600000 }); console.log(u, 'loaded in', Date.now() - t0, p.url()); }
await b.close();
