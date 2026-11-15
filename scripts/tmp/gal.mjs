import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, opts] of [['desk', { viewport: { width: 1200, height: 900 } }], ['phone', devices['Pixel 7']]]) {
  const p = await b.newPage(opts);
  await p.goto('http://localhost:5181/');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/gallery-${name}.png` });
}
await b.close();
