/*
  pie-backend.test.mjs

  Backend integration tests for the revenue-share pie representation API.
  These tests exercise `/api/rfm?view=pie` directly and validate response
  shape, date-range filtering, and edge scenarios.
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

function buildSingleCountryCsv() {
  return [
    "Invoice,StockCode,Description,Quantity,InvoiceDate,UnitPrice,CustomerID,Country",
    "990001,SK001,Single Country Row A,2,7/4/2099 10:00,5.00,90001,SoloLand",
    "990002,SK002,Single Country Row B,1,7/4/2099 10:30,10.00,90002,SoloLand",
    "990003,SK003,Single Country Row C,3,7/4/2099 11:00,2.00,90003,SoloLand"
  ].join("\n");
}

function buildLargeDatasetCsv(rowCount = 1200, countryCount = 20) {
  const lines = ["Invoice,StockCode,Description,Quantity,InvoiceDate,UnitPrice,CustomerID,Country"];

  for (let i = 0; i < rowCount; i += 1) {
    const invoice = 880000 + i;
    const stockCode = `L${String(i).padStart(5, "0")}`;
    const description = `Large Dataset Item ${i}`;
    const quantity = (i % 5) + 1;
    const unitPrice = ((i % 9) + 1).toFixed(2);
    const customerId = 70000 + i;
    const country = `LoadCountry-${i % countryCount}`;
    lines.push(`${invoice},${stockCode},${description},${quantity},8/15/2098 09:00,${unitPrice},${customerId},${country}`);
  }

  return lines.join("\n");
}

function assertPieShape(body, messageContext) {
  if (!body || typeof body !== "object") {
    throw new Error(`expected JSON object for ${messageContext}`);
  }

  if (!("totalRevenue" in body)) {
    throw new Error(`expected totalRevenue in ${messageContext}`);
  }

  if (!Array.isArray(body.slices)) {
    throw new Error(`expected slices array in ${messageContext}`);
  }

  for (const slice of body.slices) {
    if (!("country" in slice) || !("revenue" in slice) || !("percentage" in slice)) {
      throw new Error(`slice missing expected keys in ${messageContext}`);
    }
  }
}

export function defineTests(ctx) {
  return [
    {
      name: "backend rfm pie: API returns revenue-share shape for valid dates",
      run: async () => {
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2010-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for backend pie query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "backend pie response");

        const totalRevenue = toNumber(res.json.totalRevenue);
        const revenueSum = res.json.slices.reduce((sum, slice) => sum + toNumber(slice.revenue), 0);
        if (Math.abs(totalRevenue - revenueSum) > 0.05) {
          throw new Error(`expected totalRevenue to match sum(slices.revenue), got total=${totalRevenue}, sum=${revenueSum}`);
        }

        const pctSum = res.json.slices.reduce((sum, slice) => sum + toNumber(slice.percentage), 0);
        if (res.json.slices.length > 0 && Math.abs(100 - pctSum) > 0.2) {
          throw new Error(`expected percentages to sum to ~100, got ${pctSum}`);
        }
      }
    },
    {
      name: "backend rfm pie: applying date filters changes response payload",
      run: async () => {
        await uploadFixture(ctx, ctx.backendBaseUrl);
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const fullStart = encodeURIComponent("2010-01-01T00:00:00");
        const fullEnd = encodeURIComponent("2010-12-31T23:59:59");
        const emptyStart = encodeURIComponent("2100-01-01T00:00:00");
        const emptyEnd = encodeURIComponent("2100-12-31T23:59:59");

        const full = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${fullStart}&endDate=${fullEnd}`);
        const empty = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${emptyStart}&endDate=${emptyEnd}`);

        if (full.status !== 200 || empty.status !== 200) {
          throw new Error(`expected 200s for filter checks, got full=${full.status}, empty=${empty.status}`);
        }

        const fullTotal = toNumber(full.json.totalRevenue);
        const emptyTotal = toNumber(empty.json.totalRevenue);
        if (fullTotal <= emptyTotal) {
          throw new Error(`expected filtered ranges to differ with fullTotal > emptyTotal, got full=${fullTotal}, empty=${emptyTotal}`);
        }
      }
    },
    {
      name: "backend rfm pie: empty range returns zero total and no slices",
      run: async () => {
        const start = encodeURIComponent("2100-01-01T00:00:00");
        const end = encodeURIComponent("2100-12-31T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for empty pie query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "empty backend pie response");
        if (toNumber(res.json.totalRevenue) !== 0) {
          throw new Error(`expected totalRevenue=0 for empty range, got ${res.json.totalRevenue}`);
        }
        if (res.json.slices.length !== 0) {
          throw new Error(`expected no slices for empty range, got ${res.json.slices.length}`);
        }
      }
    },
    {
      name: "backend rfm pie: single-country dataset returns one 100% slice",
      run: async () => {
        await uploadCsv(ctx, ctx.backendBaseUrl, buildSingleCountryCsv(), "single-country-2099.csv");
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2099-07-04T00:00:00");
        const end = encodeURIComponent("2099-07-04T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for single-country pie query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "single-country backend pie response");
        if (res.json.slices.length !== 1) {
          throw new Error(`expected exactly one slice for single-country dataset, got ${res.json.slices.length}`);
        }

        const slice = res.json.slices[0];
        if (String(slice.country) !== "SoloLand") {
          throw new Error(`expected single country SoloLand, got '${slice.country}'`);
        }

        const percentage = toNumber(slice.percentage);
        if (Math.abs(100 - percentage) > 0.0001) {
          throw new Error(`expected 100% slice for single-country dataset, got ${percentage}`);
        }
      }
    },
    {
      name: "backend rfm pie: large dataset returns many slices and valid totals",
      run: async () => {
        await uploadCsv(ctx, ctx.backendBaseUrl, buildLargeDatasetCsv(), "large-pie-2098.csv");
        const jobId = await createCleaningJob(ctx, ctx.backendBaseUrl, 5000);
        await waitForCompletedCleaningJob(ctx, ctx.backendBaseUrl, jobId);

        const start = encodeURIComponent("2098-08-15T00:00:00");
        const end = encodeURIComponent("2098-08-15T23:59:59");
        const res = await ctx.http("GET", `${ctx.backendBaseUrl}${PIE_PATH}&startDate=${start}&endDate=${end}`);

        if (res.status !== 200) {
          throw new Error(`expected 200 for large-dataset pie query, got ${res.status}: ${res.text}`);
        }

        assertPieShape(res.json, "large-dataset backend pie response");

        if (res.json.slices.length < 10) {
          throw new Error(`expected many country slices for large dataset, got ${res.json.slices.length}`);
        }

        const totalRevenue = toNumber(res.json.totalRevenue);
        if (totalRevenue <= 0) {
          throw new Error(`expected positive totalRevenue for large dataset, got ${totalRevenue}`);
        }
      }
    }
  ];
}

export default defineTests;