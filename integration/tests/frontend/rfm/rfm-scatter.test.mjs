/*
  rfm-scatter.test.mjs

  Frontend integration tests for the RFM scatter representation proxy endpoint.
  These tests exercise the frontend proxy `/api/rfm?view=scatter` to
  ensure the backend validation and JSON shape are preserved.
*/

export function defineTests(ctx) {
  return [
    {
      name: "frontend rfm feature: proxy returns 200 and JSON array for valid dates",
      run: async () => {
        const start = encodeURIComponent("2020-01-01T00:00:00");
        const end = encodeURIComponent("2021-01-01T00:00:00");
        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=scatter&startDate=${start}&endDate=${end}`
        );

        if (res.status !== 200) {
          throw new Error(`expected 200 for valid rfm query, got ${res.status}: ${res.text}`);
        }

        if (!Array.isArray(res.json)) {
          throw new Error(`expected JSON array from /api/rfm?view=scatter, got ${typeof res.json}`);
        }

        // If there is at least one entry, assert the expected shape.
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
      name: "frontend rfm feature: missing required params returns 400",
      run: async () => {
        // Omit startDate to trigger backend validation -> 400 via frontend proxy
        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=scatter&endDate=2021-01-01T00:00:00`
        );

        if (res.status !== 400) {
          throw new Error(`expected 400 for missing params via frontend proxy, got ${res.status}`);
        }
      }
    },
    {
      name: "frontend rfm feature: country filter is accepted and returns 200",
      run: async () => {
        const start = encodeURIComponent("2020-01-01T00:00:00");
        const end = encodeURIComponent("2021-01-01T00:00:00");
        const country = encodeURIComponent("United Kingdom");

        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=scatter&startDate=${start}&endDate=${end}&country=${country}`
        );

        if (res.status !== 200) {
          throw new Error(`expected 200 for rfm query with country, got ${res.status}: ${res.text}`);
        }

        if (!Array.isArray(res.json)) {
          throw new Error(`expected JSON array from /api/rfm?view=scatter with country, got ${typeof res.json}`);
        }
      }
    }
  ];
}
