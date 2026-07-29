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

test("server-renders the focused Korean game launcher", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>Keep the Ledger \| 던전 원정 장부<\/title>/i);
  assert.match(html, /게임 시작/);
  assert.match(html, /연대기 모드/);
  assert.match(html, /커스텀 게임/);
  assert.match(html, /연대기 트랙/);
  assert.match(html, /룰북/);
  assert.doesNotMatch(html, /영웅은 몰라도|현재 습격|desktop-rail/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships the real token model, persistence, rulebooks, and static export", async () => {
  const [page, data, exportedHtml] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
    readFile(new URL("../out/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(page, /keep-the-ledger:v3/);
  assert.match(page, /keep-the-ledger:v2/);
  assert.match(page, /keep-the-ledger:v1/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /navigator\.serviceWorker/);
  assert.match(page, /player-rulebook\.pdf/);
  assert.doesNotMatch(page, /dungeon-book\.pdf/);
  assert.match(page, /StagePageDialog/);
  assert.match(page, /freshHeroTokens/);
  assert.match(page, /heroTokens/);
  assert.match(page, /eventTokens/);
  assert.match(page, /웨이브 2 시작 · 초기화/);
  assert.match(page, /assets\/icons\/event\.png/);
  assert.match(page, /noviceCards:\s*4/);
  assert.match(page, /noviceCards:\s*8/);
  assert.match(page, /noviceCards:\s*12/);
  assert.match(page, /침입 토큰/);
  assert.match(data, /stageIds:\s*\[1,\s*4,\s*13,\s*15\]/);
  assert.match(data, /stageIds:\s*\[3,\s*9,\s*19,\s*20\]/);
  assert.match(data, /1:\s*\[\{ label: "마녀", count: 2 \}\]/);
  assert.match(data, /2:\s*\[\{ label: "처형인", count: 4 \}\]/);
  assert.match(data, /\{ label: "마녀 집회", count: 4 \}/);
  assert.match(data, /20:\s*\[\]/);
  assert.match(exportedHtml, /Keep the Ledger/);

  await Promise.all([
    access(new URL("../out/rulebooks/player-rulebook.pdf", import.meta.url)),
    access(new URL("../out/rulebooks/dungeon-book.pdf", import.meta.url)),
    access(new URL("../out/assets/dungeon-pages/stage-23.jpg", import.meta.url)),
    access(new URL("../out/assets/heroes/warrior.png", import.meta.url)),
    access(new URL("../out/assets/heroes/rogue.png", import.meta.url)),
    access(new URL("../out/assets/heroes/archer.png", import.meta.url)),
    access(new URL("../out/assets/heroes/mage.png", import.meta.url)),
    access(new URL("../out/assets/heroes/novice.png", import.meta.url)),
    access(new URL("../out/assets/icons/event.png", import.meta.url)),
    access(new URL("../out/manifest.webmanifest", import.meta.url)),
    access(new URL("../out/sw.js", import.meta.url)),
  ]);
});
