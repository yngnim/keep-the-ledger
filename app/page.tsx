"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bonusStages,
  chapters,
  chronologicalStages,
  rulebookSections,
  stageById,
  stageEventCards,
  stages,
  type Chapter,
  type Stage,
} from "./data";

type Screen = "home" | "select" | "setup" | "play";
type GameMode = "chronicle" | "custom";
type Difficulty = "beginner" | "challenger" | "expert";
type HeroKey = "rogue" | "archer" | "mage" | "warrior";
type RoomTokenKey = "sword" | "eye" | "bone" | "hat";
type CompletionMap = Record<number, boolean>;
type HeroTokenState = Record<HeroKey, Record<RoomTokenKey, boolean>>;
type NoviceTokenCounts = Record<RoomTokenKey, number>;
type BackupEnvelope = {
  format: "keep-the-ledger-backup";
  version: 1;
  exportedAt: string;
  state: AppState;
};

type AppState = {
  screen: Screen;
  mode: GameMode;
  stageId: number;
  difficulty: Difficulty;
  novicesEnabled: boolean;
  completions: CompletionMap;
  checklist: Record<number, boolean[]>;
  heroTokens: HeroTokenState;
  eventTokens: boolean[];
  noviceTokenCounts: NoviceTokenCounts;
  noviceTokens: boolean[];
  notes: string;
  updatedAt: string;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STORAGE_KEY = "keep-the-ledger:v4";
const PREVIOUS_STORAGE_KEY = "keep-the-ledger:v3";
const V2_STORAGE_KEY = "keep-the-ledger:v2";
const LEGACY_STORAGE_KEY = "keep-the-ledger:v1";

const roomTokens: Array<{
  key: RoomTokenKey;
  label: string;
  rooms: string;
  icon: string;
}> = [
  {
    key: "sword",
    label: "검",
    rooms: "대장간 · 공방",
    icon: "/assets/icons/sword.svg",
  },
  {
    key: "eye",
    label: "눈",
    rooms: "묘지 · 서재",
    icon: "/assets/icons/eye.svg",
  },
  {
    key: "bone",
    label: "뼈",
    rooms: "하수도 · 야수 조련실",
    icon: "/assets/icons/bone.svg",
  },
  {
    key: "hat",
    label: "모자",
    rooms: "도서관 · 약제실",
    icon: "/assets/icons/hat.svg",
  },
];

const heroes: Array<{
  key: HeroKey;
  label: string;
  image: string;
  tone: string;
}> = [
  {
    key: "warrior",
    label: "전사",
    image: "/assets/heroes/warrior.png",
    tone: "warrior",
  },
  {
    key: "rogue",
    label: "도적",
    image: "/assets/heroes/rogue.png",
    tone: "rogue",
  },
  {
    key: "archer",
    label: "궁수",
    image: "/assets/heroes/archer.png",
    tone: "archer",
  },
  {
    key: "mage",
    label: "마법사",
    image: "/assets/heroes/mage.png",
    tone: "mage",
  },
];

const difficulties: Record<
  Difficulty,
  { label: string; noviceCards: number }
> = {
  beginner: { label: "초심자", noviceCards: 4 },
  challenger: { label: "도전자", noviceCards: 8 },
  expert: { label: "전문가", noviceCards: 12 },
};

function asset(path: string) {
  return `${BASE_PATH}${path}`;
}

function stageCode(stage: Stage) {
  return stage.code ?? String(stage.id).padStart(2, "0");
}

function stagePages(stage: Stage) {
  return stage.pages ?? [stage.page];
}

function stageBookLabel(stage: Stage) {
  return stage.book === "boss" ? "보스 배틀 책자" : "던전 책자";
}

function stagePageLabel(stage: Stage) {
  const pages = stagePages(stage);
  return pages.length === 1
    ? `${pages[0]}쪽`
    : `${pages[0]}–${pages.at(-1)}쪽`;
}

function stagePageImage(stage: Stage, page = stage.page) {
  return asset(
    stage.book === "boss"
      ? `/assets/boss-battle-pages/page-${String(page).padStart(2, "0")}.webp`
      : `/assets/dungeon-pages/stage-${String(page).padStart(2, "0")}.jpg`,
  );
}

function chapterRewardUnlocked(
  chapter: Chapter,
  completions: CompletionMap,
) {
  return chapter.rewardUnlockStageId
    ? Boolean(completions[chapter.rewardUnlockStageId])
    : chapter.stageIds.every((id) => completions[id]);
}

function automaticSetupItems(
  stage: Stage,
  completions: CompletionMap,
) {
  const items = [...stage.setup];
  if (completions[24]) {
    items.push(
      "장치 설계도 해금: 카드 팩 G의 새 카드를 장치 카드 더미에 포함합니다.",
    );
  }
  if (completions[27]) {
    items.push(
      "고철로봇 설계자 해금: 수호자 방이 없는 시나리오라면 고철 더미 토큰을 대장간에 놓고 장치 카드 더미를 전리품 상점 옆에 준비합니다.",
    );
  }
  if (completions[33]) {
    items.push(
      "비밀 산타 해금: 몬스터를 고른 뒤 각자 전리품 3장 중 1장을 오른쪽 플레이어에게 뒷면으로 줍니다. 혼자라면 3장 중 1장을 가집니다.",
    );
  }
  return items;
}

function freshHeroTokens(): HeroTokenState {
  return Object.fromEntries(
    heroes.map((hero) => [
      hero.key,
      Object.fromEntries(roomTokens.map((token) => [token.key, true])),
    ]),
  ) as HeroTokenState;
}

function novicePresetCounts(difficulty: Difficulty): NoviceTokenCounts {
  const copies = difficulties[difficulty].noviceCards / roomTokens.length;
  return Object.fromEntries(
    roomTokens.map((token) => [token.key, copies]),
  ) as NoviceTokenCounts;
}

function noviceTokenTotal(counts: NoviceTokenCounts) {
  return roomTokens.reduce((total, token) => total + counts[token.key], 0);
}

function freshNoviceTokens(counts: NoviceTokenCounts, enabled: boolean) {
  return enabled
    ? Array.from({ length: noviceTokenTotal(counts) }, () => true)
    : [];
}

const defaultState: AppState = {
  screen: "home",
  mode: "chronicle",
  stageId: 1,
  difficulty: "beginner",
  novicesEnabled: true,
  completions: {},
  checklist: {},
  heroTokens: freshHeroTokens(),
  eventTokens: [],
  noviceTokenCounts: novicePresetCounts("beginner"),
  noviceTokens: [],
  notes: "",
  updatedAt: new Date(0).toISOString(),
};

function nextChronicleStage(completions: CompletionMap) {
  return (
    chronologicalStages.find((stage) => !completions[stage.id]) ??
    chronologicalStages.at(-1) ??
    stageById[1]
  );
}

function eventCardCount(stage: Stage) {
  return (stageEventCards[stage.id] ?? []).reduce(
    (total, card) => total + card.count,
    0,
  );
}

function migrateStoredState(value: unknown): AppState {
  if (!value || typeof value !== "object") return defaultState;
  const parsed = value as Partial<AppState> & {
    currentStageId?: number;
    results?: Record<number, "win" | "loss" | null>;
    wave?: 1 | 2;
  };
  const { wave: legacyWave, ...currentFields } = parsed;
  const storedScreen = (parsed as { screen?: string }).screen;
  const stageId = parsed.stageId ?? parsed.currentStageId ?? 1;
  const difficulty = parsed.difficulty ?? defaultState.difficulty;
  const presetCounts = novicePresetCounts(difficulty);
  const noviceTokenCounts = Object.fromEntries(
    roomTokens.map((token) => {
      const storedCount = parsed.noviceTokenCounts?.[token.key];
      const count =
        typeof storedCount === "number" && Number.isFinite(storedCount)
          ? Math.max(0, Math.min(3, Math.round(storedCount)))
          : presetCounts[token.key];
      return [token.key, count];
    }),
  ) as NoviceTokenCounts;
  const expectedEventCount = eventCardCount(stageById[stageId] ?? stageById[1]);
  const expectedNoviceCount =
    parsed.novicesEnabled === false
      ? 0
      : noviceTokenTotal(noviceTokenCounts);
  const screen: Screen =
    storedScreen === "start"
      ? "setup"
      : storedScreen === "home" ||
          storedScreen === "select" ||
          storedScreen === "setup" ||
          storedScreen === "play"
        ? storedScreen
        : "home";
  const legacyCompletions = Object.fromEntries(
    Object.entries(parsed.results ?? {})
      .filter(([, result]) => result === "win")
      .map(([id]) => [Number(id), true]),
  );

  return {
    ...defaultState,
    ...currentFields,
    screen,
    stageId,
    completions: { ...legacyCompletions, ...parsed.completions },
    heroTokens: parsed.heroTokens ?? freshHeroTokens(),
    noviceTokenCounts,
    eventTokens:
      parsed.eventTokens?.length === expectedEventCount
        ? parsed.eventTokens
        : Array.from({ length: expectedEventCount }, () => true),
    noviceTokens:
      legacyWave || parsed.noviceTokens?.length !== expectedNoviceCount
        ? freshNoviceTokens(
            noviceTokenCounts,
            parsed.novicesEnabled !== false,
          )
        : (parsed.noviceTokens ?? []),
  };
}

function backupStateFrom(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("백업 파일의 형식을 확인할 수 없습니다.");
  }

  const payload = value as Partial<BackupEnvelope> & Record<string, unknown>;
  const candidate =
    payload.format === "keep-the-ledger-backup" ? payload.state : payload;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    (!("stageId" in candidate) && !("currentStageId" in candidate)) ||
    (!("completions" in candidate) && !("results" in candidate))
  ) {
    throw new Error("Keep the Ledger 기록 백업 파일이 아닙니다.");
  }

  return migrateStoredState(candidate);
}

function FlowSteps({
  mode,
  screen,
}: {
  mode: GameMode;
  screen: Screen;
}) {
  const active = screen === "setup" ? 1 : screen === "play" ? 2 : 0;
  const labels =
    mode === "chronicle"
      ? ["연대기 트랙", "던전 세팅", "플레이 보조"]
      : ["던전 선택", "던전 세팅", "플레이 보조"];

  return (
    <ol className="flow-steps" aria-label="게임 진행 단계">
      {labels.map((label, index) => (
        <li
          key={label}
          className={`${index === active ? "active" : ""} ${
            index < active ? "done" : ""
          }`}
          aria-current={index === active ? "step" : undefined}
        >
          <span>{index < active ? "✓" : index + 1}</span>
          <strong>{label}</strong>
        </li>
      ))}
    </ol>
  );
}

function StageIdentity({ stage }: { stage: Stage }) {
  return (
    <div className="stage-identity">
      <span>{stageCode(stage)}</span>
      <div>
        <small>시나리오</small>
        <h1>{stage.title}</h1>
      </div>
    </div>
  );
}

function GameConfig({
  state,
  bannedClans,
  banScope,
  onDifficulty,
  onNovices,
  onNoviceCount,
}: {
  state: AppState;
  bannedClans: string[];
  banScope: string;
  onDifficulty: (difficulty: Difficulty) => void;
  onNovices: (enabled: boolean) => void;
  onNoviceCount: (token: RoomTokenKey, count: number) => void;
}) {
  const noviceCount = noviceTokenTotal(state.noviceTokenCounts);

  return (
    <section className="config-panel">
      <div className="section-title">
        <div>
          <small>게임 준비</small>
          <h2>난이도</h2>
        </div>
        <p>
          난이도는 기본 구성을 채웁니다. 신참 카드는 아래에서 직접 조절할 수
          있습니다.
        </p>
      </div>

      <div className="difficulty-grid">
        {(Object.keys(difficulties) as Difficulty[]).map((key) => {
          const difficulty = difficulties[key];
          return (
            <button
              key={key}
              type="button"
              className={state.difficulty === key ? "selected" : ""}
              onClick={() => onDifficulty(key)}
              aria-pressed={state.difficulty === key}
            >
              <strong>{difficulty.label}</strong>
              <span>기본 {difficulty.noviceCards}장</span>
            </button>
          );
        })}
      </div>

      <label className="novice-toggle">
        <input
          type="checkbox"
          checked={state.novicesEnabled}
          onChange={(event) => onNovices(event.target.checked)}
        />
        <span aria-hidden="true" />
        <div>
          <strong>신참 사용</strong>
          <small>
            {state.novicesEnabled
              ? `현재 ${noviceCount}장을 길드 카드 더미에 추가`
              : "신참 카드를 사용하지 않음"}
          </small>
        </div>
      </label>

      {state.novicesEnabled && (
        <section className="novice-customizer">
          <header>
            <div>
              <small>직접 선택</small>
              <strong>신참 카드 구성</strong>
            </div>
            <span>총 {noviceCount}장</span>
          </header>
          <div className="novice-count-grid">
            {roomTokens.map((token) => {
              const count = state.noviceTokenCounts[token.key];
              return (
                <article key={token.key}>
                  <div>
                    <img src={asset(token.icon)} alt="" />
                    <strong>{token.label}</strong>
                  </div>
                  <div className="novice-count-stepper">
                    <button
                      type="button"
                      onClick={() => onNoviceCount(token.key, count - 1)}
                      disabled={count === 0}
                      aria-label={`${token.label} 신참 카드 1장 빼기`}
                    >
                      −
                    </button>
                    <output aria-label={`${token.label} 신참 카드 ${count}장`}>
                      {count}
                    </output>
                    <button
                      type="button"
                      onClick={() => onNoviceCount(token.key, count + 1)}
                      disabled={count === 3}
                      aria-label={`${token.label} 신참 카드 1장 추가`}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p>
            난이도를 다시 선택하면 각 모양이 1장·2장·3장씩 기본 구성으로
            돌아갑니다.
          </p>
        </section>
      )}

      {bannedClans.length > 0 && (
        <div className="clan-ban">
          <div>
            <small>{banScope}</small>
            <strong>사용할 수 없는 클랜</strong>
          </div>
          <div className="clan-ban-list">
            {bannedClans.map((clan) => (
              <span key={clan}>{clan}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ChronicleTrack({
  completions,
  editing,
  onToggleEditing,
  onToggleStage,
  onStartStage,
  onBackup,
  onReward,
}: {
  completions: CompletionMap;
  editing: boolean;
  onToggleEditing: () => void;
  onToggleStage: (stageId: number) => void;
  onStartStage: (stageId: number) => void;
  onBackup: () => void;
  onReward: (chapter: Chapter) => void;
}) {
  const completeCount = chronologicalStages.filter(
    (stage) => completions[stage.id],
  ).length;

  return (
    <section className="chronicle-track">
      <header className="track-header">
        <div>
          <small>캠페인 진행도</small>
          <h2>연대기 트랙</h2>
        </div>
        <div className="track-actions">
          <span>{completeCount} / {chronologicalStages.length} 완료</span>
          <button type="button" onClick={onBackup}>
            기록 관리
          </button>
          <button type="button" onClick={onToggleEditing}>
            {editing ? "수정 완료" : "수정"}
          </button>
        </div>
      </header>

      {editing && (
        <p className="edit-notice">
          미완료 시나리오를 누르면 그 지점까지 완료됩니다. 완료된 시나리오를
          누르면 그 시나리오부터 이후 기록이 해제됩니다.
        </p>
      )}

      <div className="chapter-list">
        {chapters.map((chapter, chapterIndex) => {
          const chapterComplete = chapterRewardUnlocked(chapter, completions);
          const chapterCount = chapter.stageIds.filter(
            (id) => completions[id],
          ).length;
          const showSeriesHeading =
            chapterIndex === 0 ||
            chapters[chapterIndex - 1]?.series !== chapter.series;

          return (
            <div className="chapter-group" key={chapter.id}>
              {showSeriesHeading && chapter.series === "boss" && (
                <div className="chapter-series-heading">
                  <small>확장 연대기</small>
                  <strong>보스 배틀</strong>
                </div>
              )}
              {showSeriesHeading && chapter.series === "bonus" && (
                <div className="chapter-series-heading bonus">
                  <small>추가 시나리오</small>
                  <strong>연말 특선</strong>
                  <span>본편 진행률과 별도로 기록됩니다.</span>
                </div>
              )}

              <article
                className={`chapter-line ${chapter.bonus ? "bonus" : ""}`}
              >
                <div className="chapter-label">
                  <span>{chapter.bonus ? "H" : String(chapter.id).padStart(2, "0")}</span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <small>
                      {chapterCount} / {chapter.stageIds.length}
                    </small>
                  </div>
                </div>

                <div
                  className={`chapter-stages count-${chapter.stageIds.length}`}
                >
                  {chapter.stageIds.map((stageId, index) => {
                    const stage = stageById[stageId];
                    const complete = Boolean(completions[stageId]);
                    const canStart = Boolean(chapter.bonus && !editing);
                    return (
                      <button
                        key={stageId}
                        type="button"
                        className={complete ? "complete" : ""}
                        onClick={() => {
                          if (editing) onToggleStage(stageId);
                          else if (canStart) onStartStage(stageId);
                        }}
                        disabled={!editing && !canStart}
                        aria-label={`${stage.title}, ${
                          complete ? "클리어" : "미완료"
                        }${
                          editing
                            ? ", 진행도 변경"
                            : canStart
                              ? ", 게임 시작"
                              : ""
                        }`}
                      >
                        <i>{complete ? "✓" : stage.code ?? index + 1}</i>
                        <span>{stage.title}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  className={`reward-access ${chapterComplete ? "unlocked" : ""}`}
                  type="button"
                  onClick={() => chapterComplete && onReward(chapter)}
                  disabled={!chapterComplete}
                  aria-label={
                    chapterComplete
                      ? `해금됨 ${chapter.reward} 보기`
                      : `${chapter.title} 해금 능력 잠김`
                  }
                >
                  <small>{chapterComplete ? "해금됨" : "해금 능력"}</small>
                  <strong>{chapterComplete ? chapter.reward : "???"}</strong>
                  <span>{chapterComplete ? "보기" : "잠김"}</span>
                </button>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HomeScreen({
  state,
  editing,
  onMode,
  onToggleEditing,
  onToggleStage,
  onStartStage,
  onBackup,
  onReward,
}: {
  state: AppState;
  editing: boolean;
  onMode: (mode: GameMode) => void;
  onToggleEditing: () => void;
  onToggleStage: (stageId: number) => void;
  onStartStage: (stageId: number) => void;
  onBackup: () => void;
  onReward: (chapter: Chapter) => void;
}) {
  return (
    <main className="home-screen">
      <section className="start-section">
        <div className="page-heading">
          <h1>게임 시작</h1>
          <p>플레이할 방식을 선택하세요.</p>
        </div>

        <div className="mode-buttons">
          <button type="button" onClick={() => onMode("chronicle")}>
            <div>
              <span>01</span>
              <small>캠페인</small>
            </div>
            <strong>연대기 모드</strong>
            <p>저장된 진행도에서 다음 시나리오를 이어서 플레이합니다.</p>
            <i>시작 →</i>
          </button>
          <button type="button" onClick={() => onMode("custom")}>
            <div>
              <span>02</span>
              <small>자유 선택</small>
            </div>
            <strong>커스텀 게임</strong>
            <p>원하는 던전을 골라 캠페인 기록과 별도로 플레이합니다.</p>
            <i>선택 →</i>
          </button>
        </div>
      </section>

      <ChronicleTrack
        completions={state.completions}
        editing={editing}
        onToggleEditing={onToggleEditing}
        onToggleStage={onToggleStage}
        onStartStage={onStartStage}
        onBackup={onBackup}
        onReward={onReward}
      />
    </main>
  );
}

function SelectScreen({
  state,
  onStage,
  onContinue,
}: {
  state: AppState;
  onStage: (stageId: number) => void;
  onContinue: () => void;
}) {
  const collections = [
    {
      label: "기본 시나리오",
      detail: "01–20",
      stages: stages.filter((stage) => stage.id <= 20),
    },
    {
      label: "보스 배틀",
      detail: "21–30",
      stages: stages.filter((stage) => stage.id >= 21 && stage.id <= 30),
    },
    {
      label: "연말 특선",
      detail: "H1–H3",
      stages: bonusStages,
    },
  ];

  return (
    <main className="flow-page">
      <FlowSteps mode={state.mode} screen={state.screen} />
      <section className="dungeon-picker">
        <div className="section-title">
          <div>
            <small>커스텀 게임</small>
            <h1>던전 선택</h1>
          </div>
          <p>플레이할 시나리오 하나를 선택하세요.</p>
        </div>
        <div className="dungeon-collections">
          {collections.map((collection) => (
            <section key={collection.label} className="dungeon-collection">
              <header>
                <h2>{collection.label}</h2>
                <span>{collection.detail}</span>
              </header>
              <div className="dungeon-grid">
                {collection.stages.map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    className={state.stageId === stage.id ? "selected" : ""}
                    onClick={() => onStage(stage.id)}
                    aria-pressed={state.stageId === stage.id}
                  >
                    <span>{stageCode(stage)}</span>
                    <strong>{stage.title}</strong>
                    <small>{stage.tags.join(" · ")}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      <div className="flow-footer">
        <button className="primary-action" type="button" onClick={onContinue}>
          던전 세팅으로
          <span>→</span>
        </button>
      </div>
    </main>
  );
}

function SetupScreen({
  state,
  resuming,
  onDifficulty,
  onNovices,
  onNoviceCount,
  onCheck,
  onBooklet,
  onPlay,
}: {
  state: AppState;
  resuming: boolean;
  onDifficulty: (difficulty: Difficulty) => void;
  onNovices: (enabled: boolean) => void;
  onNoviceCount: (token: RoomTokenKey, count: number) => void;
  onCheck: (index: number) => void;
  onBooklet: () => void;
  onPlay: () => void;
}) {
  const stage = stageById[state.stageId];
  const setupItems = automaticSetupItems(stage, state.completions);
  const storedChecklist = state.checklist[stage.id];
  const checked =
    storedChecklist?.length === setupItems.length
      ? storedChecklist
      : setupItems.map(() => false);
  const pageImage = stagePageImage(stage);
  const currentChapter = chapters.find((chapter) =>
    chapter.stageIds.includes(stage.id),
  );
  const stageBannedClans = stage.clanBan
    ? stage.clanBan.split(" · ")
    : [];
  const bannedClans =
    state.mode === "chronicle" && currentChapter?.bannedClans.length
      ? currentChapter.bannedClans
      : stageBannedClans;
  const banScope =
    state.mode === "chronicle" && currentChapter?.bannedClans.length
      ? `연대기 ${currentChapter.id}장`
      : "이 시나리오";

  return (
    <main className="flow-page">
      <FlowSteps mode={state.mode} screen={state.screen} />
      <section className="setup-header">
        <StageIdentity stage={stage} />
        <div className="setup-meta">
          <span>{difficulties[state.difficulty].label}</span>
          <span>
            {state.novicesEnabled
              ? `신참 ${noviceTokenTotal(state.noviceTokenCounts)}장`
              : "신참 미사용"}
          </span>
        </div>
      </section>

      <div className="setup-prep-layout">
        <GameConfig
          state={state}
          bannedClans={bannedClans}
          banScope={banScope}
          onDifficulty={onDifficulty}
          onNovices={onNovices}
          onNoviceCount={onNoviceCount}
        />

        <aside className="booklet-card">
          <img
            src={pageImage}
            alt={`${stage.title} ${stageBookLabel(stage)} ${stagePageLabel(stage)}`}
          />
          <div>
            <small>{stageBookLabel(stage)}</small>
            <strong>{stagePageLabel(stage)}</strong>
            <button type="button" onClick={onBooklet}>
              이미지 크게 보기
            </button>
          </div>
        </aside>
      </div>

      <div className="setup-content-layout">
        <section className="plain-section story-section">
          <div className="section-title compact">
            <div>
              <small>시나리오</small>
              <h2>이야기와 기믹</h2>
            </div>
          </div>
          <p className="stage-story">{stage.story}</p>
          <div className="highlight-rule">
            <small>핵심</small>
            <strong>{stage.highlight}</strong>
          </div>
          <div className="rule-list">
            {stage.rules.map((rule) => (
              <article key={`${rule.kind}-${rule.title}`}>
                <span>{rule.kind}</span>
                <div>
                  <h3>{rule.title}</h3>
                  <p>{rule.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="plain-section checklist-section">
          <div className="section-title compact">
            <div>
              <small>준비</small>
              <h2>던전 세팅</h2>
            </div>
            <p>
              {checked.filter(Boolean).length} / {checked.length}
            </p>
          </div>
          <div className="setup-checklist">
            {setupItems.map((item, index) => (
              <label key={item} className={checked[index] ? "checked" : ""}>
                <input
                  type="checkbox"
                  checked={Boolean(checked[index])}
                  onChange={() => onCheck(index)}
                />
                <span>{checked[index] ? "✓" : index + 1}</span>
                <strong>{item}</strong>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="flow-footer">
        <button className="primary-action" type="button" onClick={onPlay}>
          {resuming ? "플레이 계속" : "플레이 시작"}
          <span>→</span>
        </button>
      </div>
    </main>
  );
}

function PlayScreen({
  state,
  onHeroToken,
  onEventToken,
  onNoviceToken,
  onWaveReset,
  onBooklet,
  onReward,
  onNotes,
  onFail,
  onClear,
}: {
  state: AppState;
  onHeroToken: (hero: HeroKey, token: RoomTokenKey) => void;
  onEventToken: (index: number) => void;
  onNoviceToken: (index: number) => void;
  onWaveReset: () => void;
  onBooklet: () => void;
  onReward: (chapter: Chapter) => void;
  onNotes: (notes: string) => void;
  onFail: () => void;
  onClear: () => void;
}) {
  const stage = stageById[state.stageId];
  const unlockedRewards = chapters.filter((chapter) =>
    chapterRewardUnlocked(chapter, state.completions),
  );
  const noviceTokenCount = state.novicesEnabled
    ? noviceTokenTotal(state.noviceTokenCounts)
    : 0;
  const noviceTokenSlots = roomTokens.flatMap((token) =>
    Array.from(
      { length: state.noviceTokenCounts[token.key] },
      () => token,
    ),
  );
  const visibleNoviceTokens =
    state.noviceTokens.length === noviceTokenCount
      ? state.noviceTokens
      : Array.from({ length: noviceTokenCount }, () => true);

  return (
    <main className="flow-page play-page">
      <FlowSteps mode={state.mode} screen={state.screen} />
      <section className="play-title">
        <StageIdentity stage={stage} />
        <div>
          <span>{state.mode === "chronicle" ? "연대기" : "커스텀"}</span>
          <span>{difficulties[state.difficulty].label}</span>
        </div>
      </section>

      <section className="play-section mechanics-section">
        <div className="section-title compact">
          <div>
            <small>STAGE RULES</small>
            <h2>기믹</h2>
          </div>
          <button type="button" onClick={onBooklet}>
            {stageBookLabel(stage)} {stagePageLabel(stage)}
          </button>
        </div>
        <div className="play-rules">
          {stage.rules.map((rule) => (
            <article key={`${rule.kind}-${rule.title}`}>
              <span>{rule.kind}</span>
              <div>
                <h3>{rule.title}</h3>
                <p>{rule.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {unlockedRewards.length > 0 && (
        <section className="play-section unlocked-rewards-section">
          <div className="section-title compact">
            <div>
              <small>CHRONICLE REWARDS</small>
              <h2>해금 능력</h2>
            </div>
          </div>
          <div className="unlocked-reward-buttons">
            {unlockedRewards.map((chapter) => (
              <button
                type="button"
                key={chapter.id}
                onClick={() => onReward(chapter)}
                aria-label={`${chapter.reward} 상세 보기`}
              >
                {chapter.reward}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="play-section invasion-section">
        <div className="section-title compact">
          <div>
            <small>UNDERGROUND MARKET</small>
            <h2>침입 토큰</h2>
          </div>
          <button className="wave-reset" type="button" onClick={onWaveReset}>
            2웨이브 초기화
          </button>
        </div>

        <p className="tracker-guide">
          길드 덱에 남은 카드를 표시합니다. 카드가 발생할 때마다 해당 토큰을
          끄세요.
        </p>

        <div className="token-legend" aria-label="방 종류 토큰 범례">
          {roomTokens.map((token) => (
            <div key={token.key}>
              <img src={asset(token.icon)} alt="" />
              <span>
                <strong>{token.label}</strong>
                <small>{token.rooms}</small>
              </span>
            </div>
          ))}
        </div>

        <div className="hero-token-list">
          {heroes.map((hero) => (
            <article className={`hero-token-row ${hero.tone}`} key={hero.key}>
              <div className="hero-name">
                <img src={asset(hero.image)} alt="" />
                <strong>{hero.label}</strong>
              </div>
              <div className="hero-token-buttons">
                {roomTokens.map((token) => {
                  const remaining = state.heroTokens[hero.key][token.key];
                  return (
                    <button
                      key={token.key}
                      type="button"
                      className={remaining ? "remaining" : "spent"}
                      onClick={() => onHeroToken(hero.key, token.key)}
                      aria-pressed={!remaining}
                      aria-label={`${hero.label} ${token.label} 토큰 ${
                        remaining ? "남음" : "사용됨"
                      }`}
                    >
                      <img src={asset(token.icon)} alt="" />
                      <span>{remaining ? "남음" : "사용"}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="extra-token-rows">
          {state.novicesEnabled && (
            <article className="extra-token-row novice-row">
              <div className="extra-token-name">
                <span className="round-token novice-token">
                  <img src={asset("/assets/heroes/novice.png")} alt="" />
                </span>
                <div>
                  <strong>신참</strong>
                </div>
              </div>
              <div className="extra-token-buttons novice-token-buttons">
                {visibleNoviceTokens.map((remaining, index) => {
                  const token = noviceTokenSlots[index];
                  return (
                    <button
                      key={`${token?.key ?? "novice"}-${index}`}
                      type="button"
                      className={remaining ? "remaining" : "spent"}
                      onClick={() => onNoviceToken(index)}
                      aria-label={`신참 ${token?.label ?? ""} 토큰 ${
                        remaining ? "남음" : "사용됨"
                      }`}
                    >
                      {token && <img src={asset(token.icon)} alt="" />}
                      <span>{remaining ? "남음" : "사용"}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          )}

          <article className="extra-token-row event-row">
            <div className="extra-token-name">
              <span className="round-token event-token">
                <img src={asset("/assets/icons/event.png")} alt="" />
              </span>
              <div>
                <strong>이벤트</strong>
                <small>
                  남은 이벤트 카드 {state.eventTokens.filter(Boolean).length}장
                </small>
              </div>
            </div>
            <div className="extra-token-buttons event-token-buttons">
              {state.eventTokens.length ? (
                state.eventTokens.map((remaining, index) => (
                  <button
                    key={index}
                    type="button"
                    className={remaining ? "remaining" : "spent"}
                    onClick={() => onEventToken(index)}
                    aria-label={`이벤트 토큰 ${index + 1}, ${
                      remaining ? "남음" : "사용됨"
                    }`}
                  >
                    <span className="event-button-icon">
                      <img src={asset("/assets/icons/event.png")} alt="" />
                    </span>
                    <span>{remaining ? "남음" : "사용"}</span>
                  </button>
                ))
              ) : (
                <span className="no-tokens">이벤트 카드 없음</span>
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="play-section memo-section">
        <div className="section-title compact">
          <div>
            <small>NOTES</small>
            <h2>메모</h2>
          </div>
        </div>
        <textarea
          value={state.notes}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="이번 게임에 필요한 내용을 적어 두세요."
          aria-label="게임 메모"
        />
      </section>

      <div className="result-actions">
        <button className="fail-action" type="button" onClick={onFail}>
          실패
        </button>
        <button className="clear-action" type="button" onClick={onClear}>
          클리어
        </button>
      </div>
    </main>
  );
}

function RewardSizeReference({
  reference,
  dialog = false,
}: {
  reference: NonNullable<Chapter["rewardReference"]>;
  dialog?: boolean;
}) {
  return (
    <div className={`reward-size-reference${dialog ? " dialog" : ""}`}>
      <div className="reward-size-heading">
        <small>{reference.title}</small>
        <span>보스 배틀 개정 규칙</span>
      </div>
      <div className="reward-size-grid">
        {reference.groups.map((group) => (
          <section
            className={`reward-size-group size-${group.size}`}
            key={group.size}
          >
            <header>
              <strong>{group.size}</strong>
              <small>{group.carry}</small>
            </header>
            <div className="reward-size-monsters">
              {group.monsters.map((monster) => (
                <span
                  className={monster === "크툴루" ? "cthulhu" : ""}
                  key={monster}
                >
                  {monster}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      {reference.notes && (
        <ul className="reward-size-notes">
          {reference.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StagePageDialog({
  stage,
  onClose,
}: {
  stage: Stage | null;
  onClose: () => void;
}) {
  if (!stage) return null;
  const pages = stagePages(stage);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="stage-page-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${stage.title} ${stageBookLabel(stage)} ${stagePageLabel(stage)}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>
              {stageBookLabel(stage)} {stagePageLabel(stage)}
            </small>
            <h2>{stage.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="책자 닫기">
            ×
          </button>
        </header>
        <div className="stage-page-scroll">
          {pages.map((page) => {
            const pageImage = stagePageImage(stage, page);
            return (
              <figure key={page}>
                {pages.length > 1 && <figcaption>{page}쪽</figcaption>}
                <img
                  src={pageImage}
                  alt={`${stage.title} ${stageBookLabel(stage)} ${page}쪽`}
                />
                <a href={pageImage} target="_blank" rel="noreferrer">
                  {page}쪽 이미지만 새 창에서 보기
                </a>
              </figure>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RulebookDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const pageStageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    pageStageRef.current?.scrollTo({ top: 0 });
  }, [open, page]);

  if (!open) return null;

  const pageImage = asset(
    `/assets/rulebook-pages/page-${String(page).padStart(2, "0")}.webp`,
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="rulebook-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="통합 플레이어 룰북"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>35쪽 통합본</small>
            <h2>플레이어 룰북</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="룰북 닫기">
            ×
          </button>
        </header>
        <div className="rulebook-body">
          <nav aria-label="룰북 목차">
            {rulebookSections.map((section) => (
              <button
                key={section.title}
                type="button"
                className={page === section.page ? "active" : ""}
                onClick={() => setPage(section.page)}
              >
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.detail}</small>
                </span>
                <i>{section.page}</i>
              </button>
            ))}
          </nav>
          <div className="rulebook-viewer">
            <div className="rulebook-page-toolbar">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ← 이전
              </button>
              <strong>
                {page} / 35
              </strong>
              <button
                type="button"
                disabled={page === 35}
                onClick={() => setPage((current) => Math.min(35, current + 1))}
              >
                다음 →
              </button>
              <a
                href={`${asset("/rulebooks/player-rulebook.pdf")}#page=${page}`}
                target="_blank"
                rel="noreferrer"
              >
                원본 PDF ↗
              </a>
            </div>
            <div className="rulebook-page-stage" ref={pageStageRef}>
              <img
                key={pageImage}
                src={pageImage}
                alt={`플레이어 룰북 ${page}쪽`}
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BackupDialog({
  open,
  state,
  onRestore,
  onClose,
}: {
  open: boolean;
  state: AppState;
  onRestore: (state: AppState) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState<AppState | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  if (!open) return null;

  const close = () => {
    setPending(null);
    setPendingName("");
    setMessage(null);
    onClose();
  };

  const downloadBackup = () => {
    const exportedAt = new Date().toISOString();
    const backup: BackupEnvelope = {
      format: "keep-the-ledger-backup",
      version: 1,
      exportedAt,
      state: { ...state, screen: "home", updatedAt: exportedAt },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `keep-the-ledger-backup-${exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ tone: "success", text: "현재 기록을 백업 파일로 저장했습니다." });
  };

  const readBackup = async (file: File) => {
    try {
      const restored = backupStateFrom(JSON.parse(await file.text()));
      setPending(restored);
      setPendingName(file.name);
      setMessage(null);
    } catch (error) {
      setPending(null);
      setPendingName("");
      setMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "백업 파일을 읽을 수 없습니다.",
      });
    }
  };

  const pendingCompleted = pending
    ? [...chronologicalStages, ...bonusStages].filter(
        (stage) => pending.completions[stage.id],
      ).length
    : 0;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="기록 백업과 불러오기"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>브라우저 저장 기록</small>
            <h2>기록 관리</h2>
          </div>
          <button type="button" onClick={close} aria-label="기록 관리 닫기">
            ×
          </button>
        </header>

        <div className="backup-dialog-body">
          <p>
            연대기 진행도와 게임 설정을 파일로 옮길 수 있습니다. 다른
            기기에서는 같은 파일을 불러오세요.
          </p>

          <div className="backup-transfer-grid">
            <article>
              <small>내보내기</small>
              <h3>기록 백업</h3>
              <p>현재 저장된 진행도와 설정을 JSON 파일로 내려받습니다.</p>
              <button type="button" onClick={downloadBackup}>
                백업 파일 다운로드
              </button>
            </article>

            <article>
              <small>가져오기</small>
              <h3>백업 불러오기</h3>
              <p>다른 기기나 이전 주소에서 내려받은 백업을 선택합니다.</p>
              <label>
                백업 파일 선택
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readBackup(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </article>
          </div>

          {pending && (
            <div className="backup-preview">
              <div>
                <small>불러올 기록</small>
                <strong>{pendingName}</strong>
                <span>
                  완료 시나리오 {pendingCompleted}개 · 난이도{" "}
                  {difficulties[pending.difficulty].label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRestore(pending);
                  setPending(null);
                  setPendingName("");
                  setMessage({
                    tone: "success",
                    text: "백업 기록을 적용했습니다.",
                  });
                }}
              >
                이 기록 적용
              </button>
            </div>
          )}

          {message && (
            <p className={`backup-message ${message.tone}`} role="status">
              {message.text}
            </p>
          )}

          <small className="backup-warning">
            백업을 적용하면 이 브라우저의 현재 기록이 선택한 파일의 기록으로
            교체됩니다.
          </small>
        </div>
      </section>
    </div>
  );
}

function RewardDialog({
  chapter,
  unlocked,
  announcement,
  onClose,
}: {
  chapter: Chapter | null;
  unlocked: boolean;
  announcement: boolean;
  onClose: () => void;
}) {
  if (!chapter) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="reward-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${chapter.reward} 능력`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <small>
          {announcement
            ? `${chapter.id}장 완료 · 능력 해금`
            : unlocked
              ? "해금된 연대기 능력"
              : "챕터 완료 시 해금"}
        </small>
        <h2>{chapter.reward}</h2>
        <p>{chapter.rewardText}</p>
        {chapter.rewardReference && (
          <RewardSizeReference reference={chapter.rewardReference} dialog />
        )}
        <button type="button" onClick={onClose}>
          확인
        </button>
      </section>
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [editingProgress, setEditingProgress] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [stagePageOpen, setStagePageOpen] = useState<Stage | null>(null);
  const [resumePlay, setResumePlay] = useState(false);
  const [rewardChapter, setRewardChapter] = useState<Chapter | null>(null);
  const [rewardAnnouncement, setRewardAnnouncement] = useState(false);
  const [returnHomeAfterReward, setReturnHomeAfterReward] = useState(false);

  useEffect(() => {
    let hydrated = defaultState;
    try {
      const stored =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(PREVIOUS_STORAGE_KEY) ??
        window.localStorage.getItem(V2_STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) hydrated = migrateStoredState(JSON.parse(stored));
    } catch {
      hydrated = defaultState;
    }

    const frame = window.requestAnimationFrame(() => {
      setState(hydrated);
      setLoaded(true);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js`)
        .catch(() => undefined);
    }
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [loaded, state]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [state.screen]);

  const activeStage = useMemo(() => stageById[state.stageId], [state.stageId]);

  const update = (recipe: (previous: AppState) => AppState) => {
    setState((previous) => ({
      ...recipe(previous),
      updatedAt: new Date().toISOString(),
    }));
  };

  const goHome = () => {
    update((previous) => ({ ...previous, screen: "home" }));
    setEditingProgress(false);
    setResumePlay(false);
  };

  const goBack = () => {
    setResumePlay(state.screen === "play");
    update((previous) => {
      if (previous.screen === "play") {
        return { ...previous, screen: "setup" };
      }
      if (previous.screen === "setup" && previous.mode === "custom") {
        return { ...previous, screen: "select" };
      }
      return { ...previous, screen: "home" };
    });
    setEditingProgress(false);
  };

  const startMode = (mode: GameMode) => {
    const stage =
      mode === "chronicle"
        ? nextChronicleStage(state.completions)
        : stageById[state.stageId] ?? stageById[1];
    update((previous) => ({
      ...previous,
      mode,
      stageId: stage.id,
      screen: mode === "chronicle" ? "setup" : "select",
      checklist:
        mode === "chronicle"
          ? {
              ...previous.checklist,
              [stage.id]: automaticSetupItems(
                stage,
                previous.completions,
              ).map(() => false),
            }
          : previous.checklist,
      notes: "",
    }));
    setResumePlay(false);
  };

  const startChronicleStage = (stageId: number) => {
    const stage = stageById[stageId];
    update((previous) => ({
      ...previous,
      mode: "chronicle",
      stageId,
      screen: "setup",
      checklist: {
        ...previous.checklist,
        [stageId]: automaticSetupItems(stage, previous.completions).map(
          () => false,
        ),
      },
      notes: "",
    }));
    setResumePlay(false);
  };

  const setDifficulty = (difficulty: Difficulty) => {
    update((previous) => {
      const noviceTokenCounts = novicePresetCounts(difficulty);
      return {
        ...previous,
        difficulty,
        noviceTokenCounts,
        noviceTokens: freshNoviceTokens(
          noviceTokenCounts,
          previous.novicesEnabled,
        ),
      };
    });
  };

  const setNovicesEnabled = (novicesEnabled: boolean) => {
    update((previous) => ({
      ...previous,
      novicesEnabled,
      noviceTokens: freshNoviceTokens(
        previous.noviceTokenCounts,
        novicesEnabled,
      ),
    }));
  };

  const setNoviceCount = (token: RoomTokenKey, count: number) => {
    update((previous) => {
      const noviceTokenCounts = {
        ...previous.noviceTokenCounts,
        [token]: Math.max(0, Math.min(3, count)),
      };
      return {
        ...previous,
        noviceTokenCounts,
        noviceTokens: freshNoviceTokens(
          noviceTokenCounts,
          previous.novicesEnabled,
        ),
      };
    });
  };

  const prepareSetup = () => {
    const stage = stageById[state.stageId];
    update((previous) => ({
      ...previous,
      screen: "setup",
      checklist: {
        ...previous.checklist,
        [stage.id]: automaticSetupItems(stage, previous.completions).map(
          () => false,
        ),
      },
      notes: "",
    }));
    setResumePlay(false);
  };

  const startPlay = () => {
    const stage = stageById[state.stageId];
    update((previous) => ({
      ...previous,
      screen: "play",
      heroTokens: freshHeroTokens(),
      eventTokens: Array.from(
        { length: eventCardCount(stage) },
        () => true,
      ),
      noviceTokens: freshNoviceTokens(
        previous.noviceTokenCounts,
        previous.novicesEnabled,
      ),
      notes: "",
    }));
  };

  const toggleChecklist = (index: number) => {
    update((previous) => {
      const setupItems = automaticSetupItems(
        stageById[previous.stageId],
        previous.completions,
      );
      const current =
        previous.checklist[previous.stageId]?.length === setupItems.length
          ? previous.checklist[previous.stageId]
          : setupItems.map(() => false);
      return {
        ...previous,
        checklist: {
          ...previous.checklist,
          [previous.stageId]: current.map((value, itemIndex) =>
            itemIndex === index ? !value : value,
          ),
        },
      };
    });
  };

  const toggleHeroToken = (hero: HeroKey, token: RoomTokenKey) => {
    update((previous) => ({
      ...previous,
      heroTokens: {
        ...previous.heroTokens,
        [hero]: {
          ...previous.heroTokens[hero],
          [token]: !previous.heroTokens[hero][token],
        },
      },
    }));
  };

  const toggleArrayToken = (
    key: "eventTokens" | "noviceTokens",
    index: number,
  ) => {
    update((previous) => ({
      ...previous,
      [key]: previous[key].map((value, itemIndex) =>
        itemIndex === index ? !value : value,
      ),
    }));
  };

  const toggleNoviceToken = (index: number) => {
    update((previous) => {
      const expected = freshNoviceTokens(
        previous.noviceTokenCounts,
        previous.novicesEnabled,
      );
      const current =
        previous.noviceTokens.length === expected.length
          ? previous.noviceTokens
          : expected;
      return {
        ...previous,
        noviceTokens: current.map((value, itemIndex) =>
          itemIndex === index ? !value : value,
        ),
      };
    });
  };

  const resetForWaveTwo = () => {
    update((previous) => ({
      ...previous,
      heroTokens: freshHeroTokens(),
      eventTokens: previous.eventTokens.map(() => true),
      noviceTokens: freshNoviceTokens(
        previous.noviceTokenCounts,
        previous.novicesEnabled,
      ),
    }));
  };

  const finishGame = (cleared: boolean) => {
    if (!cleared || state.mode === "custom") {
      goHome();
      return;
    }

    const chapter = chapters.find((item) =>
      item.stageIds.includes(activeStage.id),
    );
    const nextCompletions = { ...state.completions, [activeStage.id]: true };
    const chapterCompleted = chapter
      ? chapterRewardUnlocked(chapter, nextCompletions)
      : false;

    update((previous) => ({
      ...previous,
      completions: nextCompletions,
      screen: chapterCompleted ? previous.screen : "home",
    }));

    if (chapterCompleted && chapter) {
      setRewardChapter(chapter);
      setRewardAnnouncement(true);
      setReturnHomeAfterReward(true);
    }
  };

  const closeReward = () => {
    setRewardChapter(null);
    setRewardAnnouncement(false);
    if (returnHomeAfterReward) {
      setReturnHomeAfterReward(false);
      goHome();
    }
  };

  return (
    <div className="site-shell">
      <header className="app-header">
        <div className="header-navigation">
          {state.screen !== "home" && (
            <button type="button" onClick={goBack}>
              ← 뒤로가기
            </button>
          )}
          <button
            type="button"
            onClick={goHome}
            aria-current={state.screen === "home" ? "page" : undefined}
          >
            홈
          </button>
        </div>
        <button
          className="rulebook-button"
          type="button"
          onClick={() => setRulebookOpen(true)}
        >
          룰북
        </button>
      </header>

      {state.screen === "home" && (
        <HomeScreen
          state={state}
          editing={editingProgress}
          onMode={startMode}
          onToggleEditing={() => setEditingProgress((value) => !value)}
          onToggleStage={(stageId) =>
            update((previous) => {
              const sequence = bonusStages.some(
                (stage) => stage.id === stageId,
              )
                ? bonusStages
                : chronologicalStages;
              const selectedIndex = sequence.findIndex(
                (stage) => stage.id === stageId,
              );
              const selectedWasComplete = Boolean(
                previous.completions[stageId],
              );
              const completedThrough = selectedWasComplete
                ? selectedIndex - 1
                : selectedIndex;
              return {
                ...previous,
                completions: {
                  ...previous.completions,
                  ...Object.fromEntries(
                    sequence.map((stage, index) => [
                      stage.id,
                      index <= completedThrough,
                    ]),
                  ),
                },
              };
            })
          }
          onStartStage={startChronicleStage}
          onBackup={() => setBackupOpen(true)}
          onReward={(chapter) => {
            setRewardChapter(chapter);
            setRewardAnnouncement(false);
            setReturnHomeAfterReward(false);
          }}
        />
      )}

      {state.screen === "select" && (
        <SelectScreen
          state={state}
          onStage={(stageId) =>
            update((previous) => ({ ...previous, stageId }))
          }
          onContinue={prepareSetup}
        />
      )}

      {state.screen === "setup" && (
        <SetupScreen
          state={state}
          resuming={resumePlay}
          onDifficulty={setDifficulty}
          onNovices={setNovicesEnabled}
          onNoviceCount={setNoviceCount}
          onCheck={toggleChecklist}
          onBooklet={() => setStagePageOpen(activeStage)}
          onPlay={() => {
            if (resumePlay) {
              update((previous) => ({ ...previous, screen: "play" }));
              setResumePlay(false);
            } else {
              startPlay();
            }
          }}
        />
      )}

      {state.screen === "play" && (
        <PlayScreen
          state={state}
          onHeroToken={toggleHeroToken}
          onEventToken={(index) => toggleArrayToken("eventTokens", index)}
          onNoviceToken={toggleNoviceToken}
          onWaveReset={resetForWaveTwo}
          onBooklet={() => setStagePageOpen(activeStage)}
          onReward={(chapter) => {
            setRewardChapter(chapter);
            setRewardAnnouncement(false);
            setReturnHomeAfterReward(false);
          }}
          onNotes={(notes) =>
            update((previous) => ({ ...previous, notes }))
          }
          onFail={() => finishGame(false)}
          onClear={() => finishGame(true)}
        />
      )}

      <BackupDialog
        open={backupOpen}
        state={state}
        onRestore={(restored) => {
          setState({
            ...restored,
            screen: "home",
            updatedAt: new Date().toISOString(),
          });
          setEditingProgress(false);
          setResumePlay(false);
          setRewardChapter(null);
          setRewardAnnouncement(false);
        }}
        onClose={() => setBackupOpen(false)}
      />
      <RulebookDialog
        open={rulebookOpen}
        onClose={() => setRulebookOpen(false)}
      />
      <StagePageDialog
        stage={stagePageOpen}
        onClose={() => setStagePageOpen(null)}
      />
      <RewardDialog
        chapter={rewardChapter}
        unlocked={
          rewardChapter
            ? chapterRewardUnlocked(rewardChapter, state.completions)
            : false
        }
        announcement={rewardAnnouncement}
        onClose={closeReward}
      />
    </div>
  );
}
