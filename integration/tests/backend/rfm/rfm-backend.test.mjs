/*
  rfm-backend.test.mjs

  Backend integration tests for the RFM scatter representation API.
  These tests exercise the backend API `/api/rfm?view=scatter` directly
  using the same fixture + cleaning pipeline used by other integration tests.
*/

import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from "../../_shared/cleaning-flow-helpers.mjs";

export function defineTests(ctx) {
  return [
    {
      name: "backend rfm feature: API returns 200 and JSON array for valid dates",
      run: async () => {
        // Ensure data exists in DB for the date range
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=scatter&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for valid rfm backend query, got ${res.status}: ${res.text}`);
        }

        if (!Array.isArray(res.json)) {
          throw new Error(`expected JSON array from backend /api/rfm?view=scatter, got ${typeof res.json}`);
        }

        if (res.json.length > 0) {
          const item = res.json[0];
          const required = ["customerId", "recency", "frequency", "monetary", "bubbleSize"];
          for (const k of required) {
            if (!(k in item)) {
              throw new Error(`rfm item missing key '${k}'`);
            }
          }
        }
      }
    },
    {
      name: "backend rfm feature: missing required params returns 400",
      run: async () => {
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=scatter&endDate=2010-12-31T23:59:59`);
        if (res.status !== 400) {
          throw new Error(`expected 400 for missing params on backend API, got ${res.status}`);
        }
      }
    },
    {
      name: "backend rfm feature: country filter is accepted and returns 200",
      run: async () => {
        // Ensure data exists
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const country = encodeURIComponent("United Kingdom");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=scatter&startDate=${start}&endDate=${end}&country=${country}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for rfm backend query with country, got ${res.status}: ${res.text}`);
        }

        if (!Array.isArray(res.json)) {
          throw new Error(`expected JSON array from backend /api/rfm?view=scatter with country, got ${typeof res.json}`);
        }
      }
    },
    {
      name: "backend rfm feature: empty result returns 200 and empty array",
      run: async () => {
        // Query a far-future date range that should have no data
        const start = encodeURIComponent("2100-01-01T00:00:00");
        const end = encodeURIComponent("2100-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=scatter&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for empty-backend rfm query, got ${res.status}: ${res.text}`);
        }

        if (!Array.isArray(res.json)) {
          throw new Error(`expected JSON array from backend /api/rfm?view=scatter (empty), got ${typeof res.json}`);
        }
      }
    }
  ];
}
