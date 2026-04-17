/*
  cleaning-flow-helpers.mjs

  Shared helpers for cleaning feature integration tests.
  - `getDirtyTotal`, `uploadFixture`, `createCleaningJob`, `waitForCompletedCleaningJob`
  These helpers encapsulate API flows and fixture handling so tests remain concise.
*/

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTEGRATION_DIR = path.resolve(__dirname, "..", "..");
const FIXTURE_FILE = path.join(INTEGRATION_DIR, "fixtures", "retail-smoke.csv");

export async function getDirtyTotal(ctx, baseUrl) {
  // Query the backend API for the dirty-data list and return the
  // reported `totalEntries` number. Tests use this to assert persisted
  // counts before/after flows.
  const res = await ctx.http("GET", `${baseUrl}/api/cleaning-data/dirty?page=0&size=15`);
  if (res.status !== 200 || !res.json) {
    throw new Error(`dirty total lookup failed with HTTP ${res.status}`);
  }

  return Number(res.json.totalEntries ?? 0);
}

export async function uploadFixture(ctx, baseUrl) {
  // Build a multipart/form-data upload using in-memory Blob so the test
  // can post the fixture file to the ingest endpoint like a browser would.
  const form = new FormData();
  const fixtureBlob = new Blob([await readFile(FIXTURE_FILE, "utf8")], {
    type: "text/csv"
  });
  form.set("file", fixtureBlob, "retail-smoke.csv");

  // Post to the RESTful ingest collection route to create an ingest resource.
  const res = await ctx.http("POST", `${baseUrl}/api/ingests`, { body: form });
  if (res.status !== 200) {
    throw new Error(`upload failed with HTTP ${res.status}: ${res.text}`);
  }
}

export async function createCleaningJob(ctx, baseUrl, batchSize = 2000) {
  // Kick off an async cleaning job and return the job ID. The service
  // returns 202 Accepted for async processing and a `jobId` in the body.
  const res = await ctx.http("POST", `${baseUrl}/api/cleaning-jobs`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchSize })
  });

  if (res.status !== 202 || !res.json?.jobId) {
    throw new Error(`job creation failed with HTTP ${res.status}: ${res.text}`);
  }

  return String(res.json.jobId);
}

export async function waitForCompletedCleaningJob(ctx, baseUrl, jobId, attempts = 120) {
  // Poll the cleaning-job status until it reaches COMPLETED or FAILED.
  // Tests use a generous default `attempts` to accommodate slower CI VMs.
  for (let i = 1; i <= attempts; i += 1) {
    const res = await ctx.http("GET", `${baseUrl}/api/cleaning-jobs/${jobId}`);
    if (res.status !== 200 || !res.json) {
      throw new Error(`job polling failed with HTTP ${res.status}`);
    }

    const status = String(res.json.status ?? "UNKNOWN");
    if (status === "COMPLETED") {
      return;
    }

    if (status === "FAILED") {
      throw new Error("job status became FAILED");
    }

    await ctx.wait(1000);
  }

  throw new Error("job did not complete before timeout");
}

export async function getCleanedTotal(ctx, baseUrl) {
  // Query cleaned-data totals so tests can decide whether seed data is needed.
  const res = await ctx.http("GET", `${baseUrl}/api/cleaning-data/cleaned?page=0&size=15`);
  if (res.status !== 200 || !res.json) {
    throw new Error(`cleaned total lookup failed with HTTP ${res.status}`);
  }

  return Number(res.json.totalEntries ?? 0);
}

export async function ensureCleanedDataExists(ctx, baseUrl) {
  // Keep export tests deterministic across fresh and reused environments.
  const cleanedBefore = await getCleanedTotal(ctx, baseUrl);
  if (cleanedBefore > 0) {
    return;
  }

  await uploadFixture(ctx, baseUrl);
  const jobId = await createCleaningJob(ctx, baseUrl);
  await waitForCompletedCleaningJob(ctx, baseUrl, jobId);

  const cleanedAfter = await getCleanedTotal(ctx, baseUrl);
  if (cleanedAfter < 1) {
    throw new Error(`expected cleaned_data totalEntries >= 1 after seeding, got ${cleanedAfter}`);
  }
}
