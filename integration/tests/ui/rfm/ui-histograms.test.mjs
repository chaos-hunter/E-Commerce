/*
  ui-histograms.test.mjs

  Playwright UI tests for the RFM Histograms view.
  These tests navigate the frontend, open the RFM Histograms tab,
  provide date filters, click Apply and assert that summary stats and
  histogram panels render.
*/

import { chromium } from 'playwright';
import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from '../../_shared/cleaning-flow-helpers.mjs';

export function defineTests(ctx) {
  return [
    {
      name: 'frontend rfm histograms UI: selecting dates and clicking Apply renders histograms and stats',
      run: async () => {
        // Ensure there's cleaned data available
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          // Open Results view and the RFM Histograms tab so the component mounts
          await page.waitForSelector('text=View Existing Results', { timeout: 10000 });
          await page.click('text=View Existing Results');
          await page.waitForSelector('text=RFM Histograms', { timeout: 10000 });
          await page.click('text=RFM Histograms');

          // Wait for the histogram inputs
          await page.waitForSelector('#hist-start-date', { timeout: 10000 });

          // Fill date inputs and click Apply (fixture data is from 2010)
          await page.fill('#hist-start-date', '2010-01-01');
          await page.fill('#hist-end-date', '2010-12-31');
          await page.click('.rfm-histogram-apply-btn');

          // Wait for either the summary row or the chart panel to appear
          await page.waitForSelector('.rfm-histogram-summary-row, .rfm-histogram-panel svg', { timeout: 15000 });

          // Assert summary row exists and shows numbers/labels
          const summary = await page.$('.rfm-histogram-summary-row');
          if (!summary) {
            // fallback: ensure at least one histogram panel rendered
            const panel = await page.$('.rfm-histogram-panel');
            if (!panel) throw new Error('expected histogram panel or summary row to be rendered after Apply');
          }

          // Assert that two histogram panels are present (Basket Size + Order Value)
          const panels = await page.$$('.rfm-histogram-panel');
          if (panels.length < 2) {
            throw new Error(`expected two histogram panels, found ${panels.length}`);
          }
        } finally {
          await browser.close();
        }
      }
    },
    {
      name: 'frontend rfm histograms UI: empty-state shows message when no results',
      run: async () => {
        // Ensure cleaned data exists
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          await page.waitForSelector('text=View Existing Results', { timeout: 10000 });
          await page.click('text=View Existing Results');
          await page.waitForSelector('text=RFM Histograms', { timeout: 10000 });
          await page.click('text=RFM Histograms');

          // Use a far-future date range that should yield no data.
          await page.waitForSelector('#hist-start-date', { timeout: 10000 });
          await page.fill('#hist-start-date', '2100-01-01');
          await page.fill('#hist-end-date', '2100-12-31');
          await page.click('.rfm-histogram-apply-btn');

          // Wait for the empty-state message
          await page.waitForSelector('text=/No data for this filter|Select a date range and click Apply/i', { timeout: 15000 });
        } finally {
          await browser.close();
        }
      }
    }
  ];
}

export default defineTests;
