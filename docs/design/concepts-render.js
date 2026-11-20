/* eslint-disable @typescript-eslint/no-require-imports -- standalone design-deck script, not app code */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1123, height: 794 } });
  await p.goto('file://' + process.argv[2], { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await p.pdf({ path: process.argv[3], width: '1123px', height: '794px', printBackground: true });
  const n = await p.locator('section.page').count();
  for (let i = 0; i < n; i++) await p.locator('section.page').nth(i).screenshot({ path: `${process.argv[4]}/p${i+1}.png` });
  await b.close();
})();
