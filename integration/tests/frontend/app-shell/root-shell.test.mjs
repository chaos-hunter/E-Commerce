/*
  root-shell.test.mjs

  Smoke test to ensure the frontend app-shell serves the root HTML page.
*/

export function defineTests(ctx) {
  return [
    {
      name: "frontend app shell: root path returns HTML",
      run: async () => {
        // Simple smoke test: GET / should serve the HTML app shell and
        // include the `#root` container where the React app mounts.
        const res = await ctx.http("GET", `${ctx.frontendBaseUrl}/`);
        if (res.status !== 200) {
          throw new Error(`expected frontend root to return 200, got ${res.status}`);
        }

        if (!res.text.includes("<div id=\"root\"></div>")) {
          throw new Error("expected frontend root HTML shell with #root container");
        }
      }
    }
  ];
}
