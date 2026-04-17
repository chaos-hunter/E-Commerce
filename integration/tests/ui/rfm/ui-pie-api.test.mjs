/*
  ui-pie-api.test.mjs

  Playwright UI tests for the Revenue Share pie-chart flow.
  These tests validate that the pie chart renders from API data and that
  applying a different date range updates the UI state correctly.
*/

import { chromium } from "playwright";
import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from "../../_shared/cleaning-flow-helpers.mjs";

export function defineTests(ctx) {
  return [
    {
      name: "frontend pie UI: applying valid dates renders pie chart and legend",
      run: async () => {
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const pageErrors = [];

        page.on("pageerror", (err) => {
          pageErrors.push(err.message);
        });

        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: "networkidle" });
          await page.waitForSelector("text=View Existing Results", { timeout: 10000 });
          await page.click("text=View Existing Results");
          await page.waitForSelector("text=Results", { timeout: 20000 });

          await page.waitForSelector("text=/RS Pie Chart/i", { timeout: 20000 });
          await page.click("text=/RS Pie Chart/i");

          await page.waitForSelector("#rs-start-date", { timeout: 10000 });
          await page.fill("#rs-start-date", "2010-01-01");
          await page.fill("#rs-end-date", "2010-12-31");
          await page.click(".rfm-apply-btn");

          await page.waitForSelector(".rs-chart-layout", { timeout: 15000 });
          await page.waitForSelector(".rs-legend-row", { timeout: 15000 });
          await page.waitForSelector(".recharts-surface", { timeout: 15000 });

          const legendRows = await page.$$(".rs-legend-row");
          if (legendRows.length < 1) {
            throw new Error(`expected at least one pie legend row, found ${legendRows.length}`);
          }

          const statCards = await page.$$(".rfm-stat-card");
          if (statCards.length < 3) {
            throw new Error(`expected summary stat cards for pie chart, found ${statCards.length}`);
          }

          if (pageErrors.length > 0) {
            throw new Error(`frontend runtime errors detected: ${pageErrors.join(" | ")}`);
          }
        } finally {
          await browser.close();
        }
      }
    },
    {
      name: "frontend pie UI: changing to empty date range shows no-data state",
      run: async () => {
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: "networkidle" });
          await page.waitForSelector("text=View Existing Results", { timeout: 10000 });
          await page.click("text=View Existing Results");
          await page.waitForSelector("text=Results", { timeout: 20000 });

          await page.waitForSelector("text=/RS Pie Chart/i", { timeout: 20000 });
          await page.click("text=/RS Pie Chart/i");

          await page.waitForSelector("#rs-start-date", { timeout: 10000 });

          // First confirm non-empty state renders for known fixture range.
          await page.fill("#rs-start-date", "2010-01-01");
          await page.fill("#rs-end-date", "2010-12-31");
          await page.click(".rfm-apply-btn");
          await page.waitForSelector(".rs-legend-row", { timeout: 15000 });

          // Then switch to empty range and assert empty-state message is shown.
          await page.fill("#rs-start-date", "2100-01-01");
          await page.fill("#rs-end-date", "2100-12-31");
          await page.click(".rfm-apply-btn");

          await page.waitForSelector("text=/No revenue data found for this date range/i", { timeout: 15000 });
        } finally {
          await browser.close();
        }
      }
    }
  ];
}

export default defineTests;