/*
  ui-cleaned-export.test.mjs

  Browser-level UI integration test for cleaned-data export.
  This test simulates a real user clicking the export button and
  validates that a downloadable XLSX file is produced.
*/

import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureCleanedDataExists } from '../../_shared/cleaning-flow-helpers.mjs';

export function defineTests(ctx) {
  return [
    {
      name: 'frontend cleaning UI: clicking download exports cleaned workbook',
      run: async () => {
        await ensureCleanedDataExists(ctx, ctx.frontendBaseUrl);

        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const dialogs = [];
        page.on('dialog', async (dialog) => {
          dialogs.push(dialog.message());
          await dialog.dismiss();
        });

        try {
          await page.goto(ctx.frontendBaseUrl, { waitUntil: 'networkidle' });

          await page.waitForSelector('text=View Existing Results', { timeout: 10000 });
          await page.click('text=View Existing Results');

          await page.waitForSelector('text=Download Cleaned Data (Excel file)', { timeout: 10000 });

          const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
          await page.click('text=Download Cleaned Data (Excel file)');
          const download = await downloadPromise;

          const suggestedName = download.suggestedFilename();
          if (suggestedName !== 'cleaned_data.xlsx') {
            throw new Error(`expected suggested filename 'cleaned_data.xlsx', got '${suggestedName}'`);
          }

          const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cleaned-export-ui-'));
          const targetFile = path.join(tempDir, suggestedName);
          await download.saveAs(targetFile);

          const fileInfo = await stat(targetFile);
          if (fileInfo.size < 4) {
            throw new Error(`expected non-empty download, got ${fileInfo.size} bytes`);
          }

          if (dialogs.length > 0) {
            throw new Error(`unexpected UI alert(s) during export: ${dialogs.join(' | ')}`);
          }
        } finally {
          await browser.close();
        }
      }
    }
  ];
}
