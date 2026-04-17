/*
  histograms.test.mjs

  Frontend integration tests for the RFM histogram representation proxy endpoint.
  These tests exercise the frontend proxy `/api/rfm?view=histogram` to ensure
  the backend and frontend wiring return the expected JSON shape and
  that date-range and country filters behave as expected.
*/

export function defineTests(ctx) {
  return [
    {
      name: "frontend rfm histograms: valid dates return histogram shape",
      run: async () => {
        const start = encodeURIComponent("2010-01-01T00:00:00");
        const end = encodeURIComponent("2021-12-31T23:59:59");

        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=histogram&startDate=${start}&endDate=${end}`
        );

        if (res.status !== 200) {
          throw new Error(`expected 200 for valid histograms query, got ${res.status}: ${res.text}`);
        }

        const body = res.json;
        // Basic shape assertions
        if (!body || typeof body !== 'object') throw new Error('expected JSON object from /api/rfm?view=histogram');
        for (const metric of ['basketSize', 'orderValue']) {
          if (!(metric in body)) throw new Error(`missing metric '${metric}' in histogram response`);
          const m = body[metric];
          const s = m.summary;
          if (!s || typeof s !== 'object') throw new Error(`missing summary for ${metric}`);
          const requiredSummary = ['invoiceCount','average','median','p90'];
          for (const k of requiredSummary) {
            if (!(k in s)) throw new Error(`summary for ${metric} missing key '${k}'`);
          }

          if (!Array.isArray(m.bins)) throw new Error(`expected bins array for ${metric}`);
          // if there is at least one bin, validate bin shape
          if (m.bins.length > 0) {
            const bin = m.bins[0];
            const requiredBinKeys = ['rangeStart','rangeEnd','count','isOutlier'];
            for (const k of requiredBinKeys) {
              if (!(k in bin)) throw new Error(`bin missing key '${k}' for ${metric}`);
            }
          }
        }
      }
    },
    {
      name: "frontend rfm histograms: missing required params returns 400",
      run: async () => {
        // Omit startDate to trigger validation -> 400 via frontend proxy
        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=histogram&endDate=2021-01-01T00:00:00`
        );

        if (res.status !== 400) {
          throw new Error(`expected 400 for missing params via frontend proxy, got ${res.status}`);
        }
      }
    },
    {
      name: "frontend rfm histograms: country filter is accepted and returns 200",
      run: async () => {
        const start = encodeURIComponent("2019-01-01T00:00:00");
        const end = encodeURIComponent("2021-01-01T00:00:00");
        const country = encodeURIComponent("United Kingdom");

        const res = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=histogram&startDate=${start}&endDate=${end}&country=${country}`
        );

        if (res.status !== 200) {
          throw new Error(`expected 200 for histograms query with country, got ${res.status}: ${res.text}`);
        }

        if (!res.json || typeof res.json !== 'object') {
          throw new Error('expected JSON object from /api/rfm?view=histogram with country');
        }
      }
    },
    {
      name: "frontend rfm histograms: changing date range updates data (narrow <= wide)",
      run: async () => {
        const wideStart = encodeURIComponent("2010-01-01T00:00:00");
        const wideEnd = encodeURIComponent("2021-12-31T23:59:59");

        const narrowStart = encodeURIComponent("2020-01-01T00:00:00");
        const narrowEnd = encodeURIComponent("2020-01-31T23:59:59");

        const wideRes = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=histogram&startDate=${wideStart}&endDate=${wideEnd}`
        );
        if (wideRes.status !== 200) throw new Error(`expected 200 for wide range, got ${wideRes.status}`);

        const narrowRes = await ctx.http(
          "GET",
          `${ctx.frontendBaseUrl}/api/rfm?view=histogram&startDate=${narrowStart}&endDate=${narrowEnd}`
        );
        if (narrowRes.status !== 200) throw new Error(`expected 200 for narrow range, got ${narrowRes.status}`);

        const wideBasket = wideRes.json.basketSize && wideRes.json.basketSize.summary && wideRes.json.basketSize.summary.invoiceCount;
        const narrowBasket = narrowRes.json.basketSize && narrowRes.json.basketSize.summary && narrowRes.json.basketSize.summary.invoiceCount;

        if (typeof wideBasket !== 'number' || typeof narrowBasket !== 'number') {
          throw new Error('expected numeric invoiceCount for basketSize summaries');
        }

        // Narrow date-range should not have more invoices than the wide range
        if (narrowBasket > wideBasket) {
          throw new Error('narrow date-range unexpectedly has more invoices than wide range — dataset may be unexpected');
        }

        // Ensure that the wide range actually contains data to make this check meaningful
        if (wideBasket === 0) {
          throw new Error('wide date-range returned zero invoices — seed data required for this integration test');
        }
      }
    }
  ];
}

export default defineTests;
