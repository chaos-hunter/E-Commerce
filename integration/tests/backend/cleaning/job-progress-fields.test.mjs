/*
  job-progress-fields.test.mjs

  Backend integration test to validate the cleaning job status shape and
  monotonic progress behavior. This asserts the job status endpoint returns
  the expected fields and that `progress` does not decrease across polls.
*/

import {
  createCleaningJob,
  uploadFixture
} from "../../_shared/cleaning-flow-helpers.mjs";

export function defineTests(ctx) {
  return [
    {
      name: 'backend cleaning: job status contains expected progress fields and is monotonic',
      run: async () => {
        // Upload fixture then start a cleaning job.
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);

        // Poll a bounded number of times and capture progress samples.
        const samples = [];
        const attempts = 120; // up to 120 seconds
        for (let i = 0; i < attempts; i += 1) {
          const res = await ctx.http('GET', `${ctx.backendBaseUrl}/api/cleaning-jobs/${jobId}`);
          if (res.status !== 200 || !res.json) {
            throw new Error(`job status lookup failed with HTTP ${res.status}`);
          }

          const body = res.json;
          // Verify required fields exist and types/ranges are sensible.
          if (typeof body.status !== 'string') throw new Error('missing string `status` in job status');
          if (typeof body.progress !== 'number') throw new Error('missing numeric `progress` in job status');
          if (typeof body.processedCount !== 'number') throw new Error('missing numeric `processedCount` in job status');
          if (typeof body.totalCount !== 'number') throw new Error('missing numeric `totalCount` in job status');

          const p = Number(body.progress);
          if (Number.isNaN(p) || p < 0 || p > 1) throw new Error(`progress out of range: ${p}`);

          samples.push(p);

          if (String(body.status) === 'COMPLETED') {
            break;
          }

          // wait 1s between polls
          await ctx.wait(1000);
        }

        if (samples.length === 0) throw new Error('no progress samples observed for job');

        // Assert monotonic non-decreasing progress
        for (let i = 1; i < samples.length; i += 1) {
          if (samples[i] < samples[i - 1]) {
            throw new Error(`progress decreased: ${samples[i - 1]} -> ${samples[i]}`);
          }
        }
      }
    }
  ];
}
