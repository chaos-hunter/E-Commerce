/*
  ui-rfm.test.mjs

  Headless browser tests for the RFM scatter plot UI using Playwright.
  These tests are run by the integration runner and require Playwright
  to be installed in `integration` (devDependency).
*/

import { chromium } from 'playwright';
import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from '../../_shared/cleaning-flow-helpers.mjs';

export function defineTests(ctx) {
  return [
    {
      name: 'frontend rfm UI: selecting dates and clicking Apply renders chart and stats',
      run: async () => {
        // Ensure there's cleaned data available so the Results view opens
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          // Open Results view and the RFM tab so the RFM component mounts
          await page.waitForSelector('text=View Existing Results', { timeout: 10000 });
          await page.click('text=View Existing Results');
          await page.waitForSelector('text=RFM Scatter Plot', { timeout: 10000 });
          await page.click('text=RFM Scatter Plot');

          // Wait for the RFM component inputs to be available on the page
          await page.waitForSelector('#start-date', { timeout: 10000 });

          // Fill date inputs and click Apply (fixture data is from 2010)
          await page.fill('#start-date', '2010-01-01');
          await page.fill('#end-date', '2010-12-31');
          await page.click('.rfm-apply-btn');

          // Wait for loading then stats or chart to appear
          await page.waitForSelector('.rfm-stats-row, .rfm-chart-area svg', { timeout: 15000 });

          // Assert that stats row (customers) or legend exists
          const stats = await page.$('.rfm-stats-row');
          if (!stats) {
            // If no stats row, ensure chart svg exists (at least one data render)
            const svg = await page.$('.rfm-chart-area svg');
            if (!svg) {
              throw new Error('expected chart SVG or stats row to be rendered after Apply');
            }
          }
        } finally {
          await browser.close();
        }
      }
    },
    {
      name: 'frontend rfm UI: empty-state shows message when no results',
      run: async () => {
        // Ensure there's cleaned data available so the Results view opens
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          // Open Results view and the RFM tab so the RFM component mounts
          await page.waitForSelector('text=View Existing Results', { timeout: 10000 });
          await page.click('text=View Existing Results');
          await page.waitForSelector('text=RFM Scatter Plot', { timeout: 10000 });
          await page.click('text=RFM Scatter Plot');

          // Use a far-future date range that should yield no data.
          await page.waitForSelector('#start-date', { timeout: 10000 });
          await page.fill('#start-date', '2100-01-01');
          await page.fill('#end-date', '2100-12-31');
          await page.click('.rfm-apply-btn');

          // Wait specifically for the final empty-state text to appear
          // (the component shows a temporary "Fetching RFM data…" state that also uses the same `.rfm-empty-state` class). 
          // Waiting for the exact text avoids capturing the transient fetching state.
          await page.waitForSelector('text=/No customers found/i', { timeout: 15000 });
        } finally {
          await browser.close();
        }
      }
    }
  ];
}
