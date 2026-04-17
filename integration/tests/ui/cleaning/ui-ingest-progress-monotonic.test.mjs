/*
  ui-ingest-progress-monotonic.test.mjs

  Playwright UI test to assert visible ingestion progress is monotonic
  (the percentage text shown in the UI does not decrease) during an
  upload + cleaning flow.
*/

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.join(__dirname, '..', '..', '..', 'fixtures', 'retail-smoke.csv');

export function defineTests(ctx) {
  return [
    {
      name: 'frontend UI: visible ingestion percent is monotonic and reaches completion',
      run: async () => {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          await page.waitForSelector('input[type=file]#fileUpload', { timeout: 10000 });
          await page.setInputFiles('input[type=file]#fileUpload', FIXTURE);
          await page.click('text=Upload and Clean Data');

          // Wait for processing UI.
          await page.waitForSelector('text=Processing...', { timeout: 15000 });

          const seen = [];
          const start = Date.now();
          const timeoutMs = 120000; // 2 minutes

          // Poll until results screen appears or timeout.
          while (Date.now() - start < timeoutMs) {
            // Try to read percentage text (e.g., "50%")
            const percentEl = await page.$('text=/\\d{1,3}%/');
            if (percentEl) {
              const txt = (await percentEl.innerText()).trim();
              const parsed = parseInt(txt.replace('%', ''), 10);
              if (!Number.isNaN(parsed)) seen.push(parsed);
            }

            // If results screen is present, finish loop.
            const results = await page.$('text=Results');
            if (results) break;

            await page.waitForTimeout(1000);
          }

          // If no percentages seen, the job may have completed quickly; ensure Results shown.
          const resultsShown = Boolean(await page.$('text=Results'));
          if (!resultsShown && seen.length === 0) {
            throw new Error('no visible percentage samples observed and Results not shown');
          }

          // Assert monotonic non-decreasing sequence
          for (let i = 1; i < seen.length; i += 1) {
            if (seen[i] < seen[i - 1]) {
              throw new Error(`visible percent decreased: ${seen[i - 1]} -> ${seen[i]}`);
            }
          }

          // If we observed values, ensure last observed is 100 or Results shown.
          if (seen.length > 0) {
            const last = seen[seen.length - 1];
            if (last < 100 && !resultsShown) {
              throw new Error(`expected final percent 100 or Results view; got final percent ${last}`);
            }
          }
        } finally {
          await browser.close();
        }
      }
    }
  ];
}
