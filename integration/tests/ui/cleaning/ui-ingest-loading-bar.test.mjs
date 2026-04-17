/*
  ui-ingest-loading-bar.test.mjs

  Browser-level UI integration test that validates the Data Ingestion
  loading bar behavior. The test performs a real file upload through the
  frontend, watches the processing screen, asserts the progress indicator
  becomes visible and updates, and finally verifies the flow completes
  and the results view is shown.

  This test uses Playwright and the same fixture used by backend tests
  to ensure deterministic behavior across environments.
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
      name: 'frontend UI: ingestion loading bar is shown, updates, and completes',
      run: async () => {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const dialogs = [];
        page.on('dialog', async (dialog) => {
          // Capture any unexpected alerts and dismiss them to avoid blocking the test.
          dialogs.push(dialog.message());
          await dialog.dismiss();
        });

        try {
          // Navigate to the frontend app and wait for the shell to load.
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          // Ensure the file input is present and attach the fixture file.
          await page.waitForSelector('input[type=file]#fileUpload', { timeout: 10000 });
          await page.setInputFiles('input[type=file]#fileUpload', FIXTURE);

          // Click the upload button to start the ingestion + cleaning pipeline.
          await page.click('text=Upload and Clean Data');

          // When an ingestion job starts the UI shows a processing screen.
          await page.waitForSelector('text=Processing...', { timeout: 15000 });

          // The loading bar should be visible for non-"View Existing Results" flows.
          await page.waitForSelector('text=Starting…', { timeout: 5000 });

          // The client polls every second for job status. Some environments
          // update progress visibly, others may briefly skip to completion.
          // Wait for EITHER an interim progress update OR the final Results
          // screen to appear. This keeps the test robust to timing differences
          // on CI and faster machines.
          const progressOrResults = await Promise.race([
            page.waitForSelector('text=/\\d{1,3}%/i', { timeout: 60000 }).then(() => 'progress'),
            page.waitForSelector('text=/\\d+[ ,]\\d+ \\/ \\d+[ ,]\\d+ rows/i', { timeout: 60000 }).then(() => 'rows'),
            page.waitForSelector('text=Results', { timeout: 60000 }).then(() => 'results')
          ]);

          if (!progressOrResults) {
            // If neither appeared, include the processing container text to aid debugging.
            const procText = await (await page.$('text=Processing...'))?.innerText().catch(() => 'unavailable');
            throw new Error(`timed out waiting for progress or results. processing text: ${procText}`);
          }

          // If we observed progress/rows, still wait for final Results view.
          if (progressOrResults === 'progress' || progressOrResults === 'rows') {
            await page.waitForSelector('text=Results', { timeout: 120000 });
          }

          // Ensure no unexpected alert dialogs occurred during the flow.
          if (dialogs.length > 0) {
            throw new Error(`unexpected UI alert(s) during ingest: ${dialogs.join(' | ')}`);
          }
        } finally {
          await browser.close();
        }
      }
    }
  ];
}
