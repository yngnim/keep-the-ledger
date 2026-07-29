import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Korean campaign companion", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>Keep the Ledger \| 던전 원정 장부<\/title>/i);
  assert.match(html, /영웅은 몰라도/);
  assert.match(html, /섬세한 요리법/);
  assert.match(html, /플레이 보조/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships persistence, rulebooks, stage pages, and static export", async () => {
  const [page, data, exportedHtml] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../out/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(page, /keep-the-ledger:v1/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /navigator\.serviceWorker/);
  assert.match(page, /player-rulebook\.pdf/);
  assert.match(page, /dungeon-book\.pdf/);
  assert.match(page, /침입 토큰 카운터/);
  assert.match(data, /stageIds:\s*\[1,\s*4,\s*13,\s*15\]/);
  assert.match(data, /stageIds:\s*\[3,\s*9,\s*19,\s*20\]/);
  assert.match(exportedHtml, /Keep the Ledger/);

  await Promise.all([
    access(new URL("../out/rulebooks/player-rulebook.pdf", import.meta.url)),
    access(new URL("../out/rulebooks/dungeon-book.pdf", import.meta.url)),
    access(new URL("../out/assets/dungeon-pages/stage-23.jpg", import.meta.url)),
    access(new URL("../out/manifest.webmanifest", import.meta.url)),
    access(new URL("../out/sw.js", import.meta.url)),
  ]);
});
