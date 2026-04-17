/*
  histograms-backend.test.mjs

  Backend integration tests for the RFM histogram representation API.
  These tests exercise `/api/rfm?view=histogram` directly and reuse the
  fixture + cleaning helpers to ensure the DB is populated for queries.
*/

import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from "../../_shared/cleaning-flow-helpers.mjs";

export function defineTests(ctx) {
  return [
    {
      name: "backend rfm histograms: API returns 200 and expected shape for valid dates",
      run: async () => {
        // Ensure data exists in DB for the date range
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=histogram&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for valid histograms backend query, got ${res.status}: ${res.text}`);
        }

        const body = res.json;
        if (!body || typeof body !== 'object') throw new Error('expected JSON object from backend /api/rfm?view=histogram');

        for (const metric of ['basketSize','orderValue']) {
          if (!(metric in body)) throw new Error(`missing metric '${metric}' in backend histogram response`);
          const m = body[metric];
          const s = m.summary;
          if (!s || typeof s !== 'object') throw new Error(`missing summary for ${metric}`);
          const requiredSummary = ['invoiceCount','average','median','p90'];
          for (const k of requiredSummary) {
            if (!(k in s)) throw new Error(`summary for ${metric} missing key '${k}'`);
          }
          if (!Array.isArray(m.bins)) throw new Error(`expected bins array for ${metric}`);
        }
      }
    },
    {
      name: "backend rfm histograms: missing required params returns 400",
      run: async () => {
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=histogram&endDate=2010-12-31T23:59:59`);
        if (res.status !== 400) {
          throw new Error(`expected 400 for missing params on backend API, got ${res.status}`);
        }
      }
    },
    {
      name: "backend rfm histograms: country filter is accepted and returns 200",
      run: async () => {
        // Ensure data exists
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const country = encodeURIComponent("United Kingdom");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=histogram&startDate=${start}&endDate=${end}&country=${country}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for histograms backend query with country, got ${res.status}: ${res.text}`);
        }

        if (!res.json || typeof res.json !== 'object') {
          throw new Error(`expected JSON object from backend /api/rfm?view=histogram with country, got ${typeof res.json}`);
        }
      }
    },
    {
      name: "backend rfm histograms: empty result returns 200 and zero invoiceCount",
      run: async () => {
        // Query a far-future date range that should have no data
        const start = encodeURIComponent("2100-01-01T00:00:00");
        const end = encodeURIComponent("2100-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}/api/rfm?view=histogram&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for empty-backend histograms query, got ${res.status}: ${res.text}`);
        }

        const body = res.json;
        if (!body || typeof body !== 'object') throw new Error('expected JSON object from backend /api/rfm?view=histogram (empty)');
        // invoiceCount should be zero for empty ranges
        const invoiceCount = body.basketSize && body.basketSize.summary && body.basketSize.summary.invoiceCount;
        if (typeof invoiceCount !== 'number') throw new Error('expected numeric invoiceCount in empty histogram response');
        if (invoiceCount !== 0) throw new Error('expected invoiceCount === 0 for empty histogram response');
      }
    }
  ];
}

export default defineTests;
