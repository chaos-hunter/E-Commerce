/*
  ingest-cleaning-flow.test.mjs

  Backend feature tests for the cleaning flow.
  - Positive path: upload fixture -> create job -> verify persisted rows
  - Negative path: invalid page parameter returns 400
*/

import {
  createCleaningJob,
  getDirtyTotal,
  uploadFixture,
  waitForCompletedCleaningJob
} from "../../_shared/cleaning-flow-helpers.mjs";

export function defineTests(ctx) {
  return [
    {
      name: "backend cleaning feature: persists and reads through API",
      run: async () => {
        // Upload a known fixture and start the cleaning job; once the job
        // completes, verify that the persisted `dirty_data` total increased.
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        // Confirm persistence by reading the total count.
        const dirtyTotal = await getDirtyTotal(ctx, ctx.backendBaseUrl);
        if (dirtyTotal < 1) {
          throw new Error(`expected dirty_data totalEntries >= 1, got ${dirtyTotal}`);
        }
      }
    },
    {
      name: "backend cleaning feature: invalid page returns 400",
      run: async () => {
        // Verify API validation: an invalid `page` parameter should return 400.
        const res = await ctx.http(
          "GET",
          `${ctx.backendBaseUrl}/api/cleaning-data/dirty?page=-1&size=15`
        );

        if (res.status !== 400) {
          throw new Error(`expected 400 for invalid page, got ${res.status}`);
        }
      }
    }
  ];
}
