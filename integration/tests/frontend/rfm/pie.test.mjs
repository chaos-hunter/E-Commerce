/*
  pie.test.mjs

  Frontend integration tests for the revenue-share pie representation proxy.
  These tests call the frontend `/api/rfm?view=pie` path to validate
  frontend-to-backend wiring, filter behavior, and edge scenarios.
*/

import { uploadFixture, createCleaningJob, waitForCompletedCleaningJob } from "../../_shared/cleaning-flow-helpers.mjs";

const PIE_PATH = "/api/rfm?view=pie";

function toNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`expected numeric value, got '${value}'`);
  }
  return n;
}

async function uploadCsv(ctx, baseUrl, csvContent, filename) {
  const form = new FormData();
  form.set("file", new Blob([csvContent], { type: "text/csv" }), filename);
  const res = await ctx.http("POST", `${baseUrl}/api/ingests`, { body: form });
  if (res.status !== 200) {
    throw new Error(`csv upload failed with HTTP ${res.status}: ${res.text}`);
  }
}

function buildLargeDatasetCsv(rowCount = 600, countryCount = 15) {
  const lines = ["Invoice,StockCode,Description,Quantity,InvoiceDate,UnitPrice,CustomerID,Country"];

  for (let i = 0; i < rowCount; i += 1) {
    const invoice = 770000 + i;
    const stockCode = `F${String(i).padStart(5, "0")}`;
    const description = `Frontend Large Dataset Item ${i}`;
    const quantity = (i % 4) + 1;
    const unitPrice = ((i % 7) + 1).toFixed(2);
    const customerId = 60000 + i;
    const country = `ProxyCountry-${i % countryCount}`;
    lines.push(`${invoice},${stockCode},${description},${quantity},6/10/2097 09:00,${unitPrice},${customerId},${country}`);
  }

  return lines.join("\n");
}

function assertPieShape(body, context) {
  if (!body || typeof body !== "object") {
    throw new Error(`expected JSON object for ${context}`);
  }

  if (!("totalRevenue" in body)) {
    throw new Error(`expected totalRevenue in ${context}`);
  }

  if (!Array.isArray(body.slices)) {
    throw new Error(`expected slices array in ${context}`);
  }
}

export function defineTests(ctx) {
  return [
    {
      name: "frontend rfm pie: proxy returns expected shape for valid dates",
      run: async () => {
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for frontend pie proxy query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "frontend pie proxy response");
      }
    },
    {
      name: "frontend rfm pie: missing required params returns 400",
      run: async () => {
        const res = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&endDate=2010-12-31T23:59:59`);
        if (res.status !== 400) {
          throw new Error(`expected 400 for missing params via frontend pie proxy, got ${res.status}`);
        }
      }
    },
    {
      name: "frontend rfm pie: date filter changes response as expected",
      run: async () => {
        await uploadFixture(ctx, ctx.frontendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const fullStart = encodeURIComponent("2010-01-01T00:00:00");
        const fullEnd = encodeURIComponent("2010-12-31T23:59:59");
        const emptyStart = encodeURIComponent("2100-01-01T00:00:00");
        const emptyEnd = encodeURIComponent("2100-12-31T23:59:59");

        const full = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&startDate=${fullStart}&endDate=${fullEnd}`);
        const empty = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&startDate=${emptyStart}&endDate=${emptyEnd}`);

        if (full.status !== 200 || empty.status !== 200) {
          throw new Error(`expected 200s for pie filter check, got full=${full.status}, empty=${empty.status}`);
        }

        const fullTotal = toNumber(full.json.totalRevenue);
        const emptyTotal = toNumber(empty.json.totalRevenue);
        if (fullTotal <= emptyTotal) {
          throw new Error(`expected non-empty range to exceed empty range total, got full=${fullTotal}, empty=${emptyTotal}`);
        }
      }
    },
    {
      name: "frontend rfm pie: empty range returns zero total and no slices",
      run: async () => {
        const start = encodeURIComponent("2100-01-01T00:00:00");
        const end = encodeURIComponent("2100-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for empty frontend pie range, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "frontend empty pie response");
        if (toNumber(res.json.totalRevenue) !== 0) {
          throw new Error(`expected totalRevenue=0 for empty range, got ${res.json.totalRevenue}`);
        }
        if (res.json.slices.length !== 0) {
          throw new Error(`expected no slices for empty range, got ${res.json.slices.length}`);
        }
      }
    },
    {
      name: "frontend rfm pie: large dataset through proxy returns multiple country slices",
      run: async () => {
        await uploadCsv(ctx, ctx.frontendBaseUrl, buildLargeDatasetCsv(), "frontend-large-pie-2097.csv");
        const jobId = await createCleaningJob(ctx, ctx.frontendBaseUrl, 4000);
        await waitForCompletedCleaningJob(ctx, ctx.frontendBaseUrl, jobId);

        const start = encodeURIComponent("2097-06-10T00:00:00");
        const end = encodeURIComponent("2097-06-10T23:59:59");
        const res = await ctx.http("GET", `${ctx.frontendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for large proxy pie query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "frontend large pie response");
        if (res.json.slices.length < 8) {
          throw new Error(`expected multiple slices for large dataset, got ${res.json.slices.length}`);
        }
      }
    }
  ];
}

export default defineTests;