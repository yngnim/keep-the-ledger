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
  assert.match(html, /<title>The Ledger<\/title>/i);
  assert.match(
    html,
    /<meta name="robots" content="[^"]*noindex[^"]*nofollow[^"]*nocache[^"]*"/i,
  );
  assert.match(
    html,
    /<meta name="googlebot" content="[^"]*noindex[^"]*nofollow[^"]*noimageindex[^"]*"/i,
  );
  assert.doesNotMatch(html, /property="og:|name="twitter:/i);
  assert.match(html, /게임 시작/);
  assert.match(html, /연대기 모드/);
  assert.match(html, /커스텀 게임/);
  assert.match(html, /연대기 트랙/);
  assert.match(html, /룰북/);
  assert.doesNotMatch(html, /영웅은 몰라도|현재 습격|desktop-rail/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("ships the real token model, persistence, rulebooks, and static export", async () => {
  const [page, data, styles, serviceWorker, exportedHtml, robots] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/data.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
      readFile(new URL("../out/index.html", import.meta.url), "utf8"),
      readFile(new URL("../out/robots.txt", import.meta.url), "utf8"),
    ]);

  assert.match(page, /keep-the-ledger:v4/);
  assert.match(page, /keep-the-ledger:v3/);
  assert.match(page, /keep-the-ledger:v2/);
  assert.match(page, /keep-the-ledger:v1/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /BackupDialog/);
  assert.match(page, /backupStateFrom/);
  assert.match(page, /keep-the-ledger-backup/);
  assert.match(page, /백업 파일 다운로드/);
  assert.match(page, /백업 파일 선택/);
  assert.match(page, /new Blob/);
  assert.match(page, /await file\.text\(\)/);
  assert.match(page, /accept="\.json,application\/json"/);
  assert.match(page, /navigator\.serviceWorker/);
  assert.match(page, /player-rulebook\.pdf/);
  assert.doesNotMatch(page, /dungeon-book\.pdf/);
  assert.match(page, /StagePageDialog/);
  assert.match(page, /freshHeroTokens/);
  assert.match(page, /heroTokens/);
  assert.match(page, /eventTokens/);
  assert.match(page, /2웨이브 초기화/);
  assert.doesNotMatch(page, /웨이브 2 다시 초기화|state\.wave/);
  assert.match(page, /assets\/icons\/event\.png/);
  assert.match(page, /noviceCards:\s*4/);
  assert.match(page, /noviceCards:\s*8/);
  assert.match(page, /noviceCards:\s*12/);
  assert.match(page, /침입 토큰/);
  assert.match(page, /freshNoviceTokens/);
  assert.match(page, /novicePresetCounts/);
  assert.match(page, /noviceTokenCounts/);
  assert.match(page, /신참 카드 구성/);
  assert.match(page, /각 모양이 1장·2장·3장씩 기본 구성/);
  assert.match(page, /noviceTokenCount/);
  assert.match(page, /noviceTokenSlots/);
  assert.doesNotMatch(page, /noviceCopies/);
  assert.doesNotMatch(page, /남은 신참 카드/);
  assert.ok(page.indexOf("novice-row") < page.indexOf("event-row"));
  assert.match(page, /unlockedRewards/);
  assert.match(page, /큰 몬스터 → 작은 몬스터/);
  assert.match(page, /assets\/rulebook-pages\/page-/);
  assert.match(page, /rulebook-page-stage/);
  assert.doesNotMatch(page, /zoom=page-width|<iframe/);
  assert.match(data, /stageIds:\s*\[1,\s*4,\s*13,\s*15\]/);
  assert.match(data, /stageIds:\s*\[3,\s*9,\s*19,\s*20\]/);
  assert.match(data, /stageIds:\s*\[21,\s*22,\s*23,\s*24\]/);
  assert.match(data, /stageIds:\s*\[28,\s*29,\s*30\]/);
  assert.match(data, /stageIds:\s*\[31,\s*32,\s*33\]/);
  assert.match(data, /code:\s*"H1"/);
  assert.match(data, /title:\s*"산타 베이비"/);
  assert.match(data, /reward:\s*"고철로봇 설계자"/);
  assert.match(data, /reward:\s*"비밀 산타"/);
  assert.match(data, /bannedClans:\s*\["도마뱀",\s*"해골"\]/);
  assert.match(data, /bannedClans:\s*\["임프",\s*"슬라임"\]/);
  assert.match(
    data,
    /드래곤 > 해골 > 유령 > 놀 > 임프 > 마녀 > 도마뱀 > 슬라임 > 쥐/,
  );
  assert.match(data, /1:\s*\[\{ label: "마녀", count: 2 \}\]/);
  assert.match(data, /2:\s*\[\{ label: "처형인", count: 4 \}\]/);
  assert.match(data, /\{ label: "마녀 집회", count: 4 \}/);
  assert.match(data, /20:\s*\[\]/);
  assert.match(data, /강령술사가 주인이 아닌 던전을 찾는 일이라/);
  assert.match(data, /그 이야기 알지\? 마녀가 순진한 왕자를 개구리로 만들었다는/);
  assert.match(data, /우리의 던전은 끝나지 않았어/);
  assert.doesNotMatch(data, /개구리 식단에 지친 마녀의 점심/);
  assert.match(styles, /grid-template-columns:\s*190px minmax\(0,\s*1fr\)/);
  assert.match(styles, /width:\s*min\(1500px,\s*100%\)/);
  assert.match(styles, /\.rulebook-page-stage img\s*\{[^}]*width:\s*100%/s);
  assert.match(serviceWorker, /keep-the-ledger-shell-v6/);
  assert.match(exportedHtml, /<title>The Ledger<\/title>/i);
  assert.match(exportedHtml, /name="robots" content="[^"]*noindex/i);
  assert.equal(robots.trim(), "User-agent: *\nDisallow: /");

  await Promise.all([
    access(new URL("../out/rulebooks/player-rulebook.pdf", import.meta.url)),
    access(new URL("../out/rulebooks/dungeon-book.pdf", import.meta.url)),
    access(
      new URL(
        "../out/assets/rulebook-pages/page-01.webp",
        import.meta.url,
      ),
    ),
    access(
      new URL(
        "../out/assets/rulebook-pages/page-35.webp",
        import.meta.url,
      ),
    ),
    access(new URL("../out/assets/dungeon-pages/stage-23.jpg", import.meta.url)),
    access(
      new URL(
        "../out/assets/boss-battle-pages/page-11.webp",
        import.meta.url,
      ),
    ),
    access(
      new URL(
        "../out/assets/boss-battle-pages/page-35.webp",
        import.meta.url,
      ),
    ),
    access(new URL("../out/assets/heroes/warrior.png", import.meta.url)),
    access(new URL("../out/assets/heroes/rogue.png", import.meta.url)),
    access(new URL("../out/assets/heroes/archer.png", import.meta.url)),
    access(new URL("../out/assets/heroes/mage.png", import.meta.url)),
    access(new URL("../out/assets/heroes/novice.png", import.meta.url)),
    access(new URL("../out/assets/icons/event.png", import.meta.url)),
    access(new URL("../out/manifest.webmanifest", import.meta.url)),
    access(new URL("../out/robots.txt", import.meta.url)),
    access(new URL("../out/sw.js", import.meta.url)),
  ]);
});
