/*
  proxy-cleaned-export.test.mjs

  Frontend-proxy integration tests for cleaned-data export endpoint.
*/

import { ensureCleanedDataExists } from "../../_shared/cleaning-flow-helpers.mjs";

const XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function assertWorkbookSignature(bytes) {
  // XLSX files are ZIP containers and should begin with "PK\x03\x04".
  if (bytes.length < 4) {
    throw new Error("expected non-empty workbook bytes");
  }

  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    throw new Error("expected XLSX ZIP signature (PK\\x03\\x04)");
  }
}

export function defineTests(ctx) {
  return [
    {
      name: "frontend cleaning export: proxy returns downloadable workbook",
      run: async () => {
        await ensureCleanedDataExists(ctx, ctx.frontendBaseUrl);

        // Request XLSX representation via frontend proxy using RESTful cleaned route.
        const res = await fetch(`${ctx.frontendBaseUrl}/api/cleaning-data/cleaned?format=xlsx`, {
          method: "GET"
        });

        if (res.status !== 200) {
          throw new Error(`expected 200 from export endpoint via frontend proxy, got ${res.status}`);
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes(XLSX_MEDIA_TYPE)) {
          throw new Error(`expected content-type to include ${XLSX_MEDIA_TYPE}, got '${contentType}'`);
        }

        const disposition = res.headers.get("content-disposition") ?? "";
        if (!disposition.includes("attachment") || !disposition.includes("cleaned-data.xlsx")) {
          throw new Error(`expected attachment filename in content-disposition, got '${disposition}'`);
        }

        const bytes = new Uint8Array(await res.arrayBuffer());
        assertWorkbookSignature(bytes);
      }
    }
  ];
}
