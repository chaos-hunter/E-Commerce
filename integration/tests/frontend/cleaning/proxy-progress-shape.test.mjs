/*
  proxy-progress-shape.test.mjs

  Frontend proxy integration test that starts a cleaning job through the
  frontend proxy and validates the proxied job status response contains
  the expected progress fields and values.
*/

import {
  uploadFixture,
  createCleaningJob
} from '../../_shared/cleaning-flow-helpers.mjs';

export function defineTests(ctx) {
  return [
    {
      name: 'frontend proxy: cleaning job status preserves progress shape',
      run: async () => {
        // Upload via frontend proxy
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);

        // Poll the frontend proxy job status endpoint a few times and validate shape
        const attempts = 60;
        for (let i = 0; i < attempts; i += 1) {
          const res = await ctx.http('GET', `${ctx.frontendBaseUrl}/api/cleaning-jobs/${jobId}`);
          if (res.status !== 200 || !res.json) {
            throw new Error(`frontend proxy job status failed with HTTP ${res.status}`);
          }

          const body = res.json;
          if (typeof body.status !== 'string') throw new Error('proxy response missing `status`');
          if (typeof body.progress !== 'number') throw new Error('proxy response missing `progress`');
          if (typeof body.processedCount !== 'number') throw new Error('proxy response missing `processedCount`');
          if (typeof body.totalCount !== 'number') throw new Error('proxy response missing `totalCount`');

          const p = Number(body.progress);
          if (Number.isNaN(p) || p < 0 || p > 1) throw new Error(`proxy progress out of range: ${p}`);

          if (String(body.status) === 'COMPLETED') {
            return;
          }

          await ctx.wait(1000);
        }

        throw new Error('proxy job did not reach COMPLETED within timeout');
      }
    }
  ];
}
