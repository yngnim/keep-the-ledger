"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  noviceTokens: boolean[];
  wave: 1 | 2;
  notes: string;
  updatedAt: string;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STORAGE_KEY = "keep-the-ledger:v3";
const PREVIOUS_STORAGE_KEY = "keep-the-ledger:v2";
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
  { label: string; noviceCards: number; note: string }
> = {
  beginner: { label: "초심자", noviceCards: 4, note: "신참 4장" },
  challenger: { label: "도전자", noviceCards: 8, note: "신참 8장" },
  expert: { label: "전문가", noviceCards: 12, note: "신참 12장" },
};

function asset(path: string) {
  return `${BASE_PATH}${path}`;
}

function freshHeroTokens(): HeroTokenState {
  return Object.fromEntries(
    heroes.map((hero) => [
      hero.key,
      Object.fromEntries(roomTokens.map((token) => [token.key, true])),
    ]),
  ) as HeroTokenState;
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
  noviceTokens: [],
  wave: 1,
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
  };
  const storedScreen = (parsed as { screen?: string }).screen;
  const stageId = parsed.stageId ?? parsed.currentStageId ?? 1;
  const expectedEventCount = eventCardCount(stageById[stageId] ?? stageById[1]);
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
    ...parsed,
    screen,
    stageId,
    completions: { ...legacyCompletions, ...parsed.completions },
    heroTokens: parsed.heroTokens ?? freshHeroTokens(),
    eventTokens:
      parsed.eventTokens?.length === expectedEventCount
        ? parsed.eventTokens
        : Array.from({ length: expectedEventCount }, () => true),
    noviceTokens: parsed.noviceTokens ?? [],
    wave: parsed.wave === 2 ? 2 : 1,
  };
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
      <span>{String(stage.id).padStart(2, "0")}</span>
      <div>
        <small>시나리오</small>
        <h1>{stage.title}</h1>
      </div>
    </div>
  );
}

function GameConfig({
  state,
  onDifficulty,
  onNovices,
}: {
  state: AppState;
  onDifficulty: (difficulty: Difficulty) => void;
  onNovices: (enabled: boolean) => void;
}) {
  return (
    <section className="config-panel">
      <div className="section-title">
        <div>
          <small>게임 준비</small>
          <h2>난이도</h2>
        </div>
        <p>난이도에 맞춰 신참 카드 수가 정해집니다.</p>
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
              <span>{difficulty.note}</span>
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
              ? `${difficulties[state.difficulty].noviceCards}장을 길드 카드 더미에 추가`
              : "신참 카드를 사용하지 않음"}
          </small>
        </div>
      </label>
    </section>
  );
}

function ChronicleTrack({
  completions,
  editing,
  onToggleEditing,
  onToggleStage,
  onReward,
}: {
  completions: CompletionMap;
  editing: boolean;
  onToggleEditing: () => void;
  onToggleStage: (stageId: number) => void;
  onReward: (chapter: Chapter) => void;
}) {
  const completeCount = Object.values(completions).filter(Boolean).length;

  return (
    <section className="chronicle-track">
      <header className="track-header">
        <div>
          <small>캠페인 진행도</small>
          <h2>연대기 트랙</h2>
        </div>
        <div className="track-actions">
          <span>{completeCount} / 20 완료</span>
          <button type="button" onClick={onToggleEditing}>
            {editing ? "수정 완료" : "수정"}
          </button>
        </div>
      </header>

      {editing && (
        <p className="edit-notice">
          시나리오를 눌러 클리어 여부를 직접 변경할 수 있습니다.
        </p>
      )}

      <div className="chapter-list">
        {chapters.map((chapter) => {
          const chapterComplete = chapter.stageIds.every(
            (id) => completions[id],
          );
          const chapterCount = chapter.stageIds.filter(
            (id) => completions[id],
          ).length;

          return (
            <article className="chapter-line" key={chapter.id}>
              <div className="chapter-label">
                <span>{String(chapter.id).padStart(2, "0")}</span>
                <div>
                  <h3>{chapter.title}</h3>
                  <small>{chapterCount} / 4</small>
                </div>
              </div>

              <div className="chapter-stages">
                {chapter.stageIds.map((stageId, index) => {
                  const stage = stageById[stageId];
                  const complete = Boolean(completions[stageId]);
                  return (
                    <button
                      key={stageId}
                      type="button"
                      className={complete ? "complete" : ""}
                      onClick={() => editing && onToggleStage(stageId)}
                      disabled={!editing}
                      aria-label={`${stage.title}, ${
                        complete ? "클리어" : "미완료"
                      }${editing ? ", 진행도 변경" : ""}`}
                    >
                      <i>{complete ? "✓" : index + 1}</i>
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
  onReward,
}: {
  state: AppState;
  editing: boolean;
  onMode: (mode: GameMode) => void;
  onToggleEditing: () => void;
  onToggleStage: (stageId: number) => void;
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
        <div className="dungeon-grid">
          {stages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={state.stageId === stage.id ? "selected" : ""}
              onClick={() => onStage(stage.id)}
              aria-pressed={state.stageId === stage.id}
            >
              <span>{String(stage.id).padStart(2, "0")}</span>
              <strong>{stage.title}</strong>
              <small>{stage.tags.join(" · ")}</small>
            </button>
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
  onCheck,
  onBooklet,
  onPlay,
}: {
  state: AppState;
  resuming: boolean;
  onDifficulty: (difficulty: Difficulty) => void;
  onNovices: (enabled: boolean) => void;
  onCheck: (index: number) => void;
  onBooklet: () => void;
  onPlay: () => void;
}) {
  const stage = stageById[state.stageId];
  const checked = state.checklist[stage.id] ?? stage.setup.map(() => false);
  const pageImage = asset(
    `/assets/dungeon-pages/stage-${String(stage.page).padStart(2, "0")}.jpg`,
  );

  return (
    <main className="flow-page">
      <FlowSteps mode={state.mode} screen={state.screen} />
      <section className="setup-header">
        <StageIdentity stage={stage} />
        <div className="setup-meta">
          <span>{difficulties[state.difficulty].label}</span>
          <span>
            {state.novicesEnabled
              ? difficulties[state.difficulty].note
              : "신참 미사용"}
          </span>
          {stage.clanBan && <span>선택 불가: {stage.clanBan}</span>}
        </div>
      </section>

      <GameConfig
        state={state}
        onDifficulty={onDifficulty}
        onNovices={onNovices}
      />

      <div className="setup-layout">
        <div className="setup-main">
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
              {stage.setup.map((item, index) => (
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

        <aside className="booklet-card">
          <img
            src={pageImage}
            alt={`${stage.title} 던전 책자 ${stage.page}쪽`}
          />
          <div>
            <small>던전 책자</small>
            <strong>{stage.page}쪽</strong>
            <button type="button" onClick={onBooklet}>
              이미지 크게 보기
            </button>
          </div>
        </aside>
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
  onNotes: (notes: string) => void;
  onFail: () => void;
  onClear: () => void;
}) {
  const stage = stageById[state.stageId];

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
            책자 {stage.page}쪽
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

      <section className="play-section invasion-section">
        <div className="section-title compact">
          <div>
            <small>UNDERGROUND MARKET</small>
            <h2>침입 토큰</h2>
          </div>
          <div className="wave-controls">
            <span>웨이브 {state.wave}</span>
            <button type="button" onClick={onWaveReset}>
              {state.wave === 1 ? "웨이브 2 시작 · 초기화" : "웨이브 2 다시 초기화"}
            </button>
          </div>
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
          <article className="extra-token-row event-row">
            <div>
              <span className="round-token event-token">
                <img src={asset("/assets/icons/event.png")} alt="" />
              </span>
              <div>
                <strong>이벤트</strong>
                <small>
                  웨이브 {state.wave} · 남은 이벤트 카드 {state.eventTokens.filter(Boolean).length}
                  장
                </small>
              </div>
            </div>
            <div className="small-token-list">
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
                    <img src={asset("/assets/icons/event.png")} alt="" />
                  </button>
                ))
              ) : (
                <span className="no-tokens">이벤트 카드 없음</span>
              )}
            </div>
          </article>

          {state.novicesEnabled && (
            <article className="extra-token-row novice-row">
              <div>
                <span className="round-token novice-token">
                  <img src={asset("/assets/heroes/novice.png")} alt="" />
                </span>
                <div>
                  <strong>신참</strong>
                  <small>
                    {state.wave === 1
                      ? "소환할 때마다 토큰 켜기"
                      : `남은 신참 카드 ${state.noviceTokens.filter(Boolean).length}장 · 발생할 때마다 끄기`}
                  </small>
                </div>
              </div>
              <div className="small-token-list novice-token-list">
                {state.noviceTokens.map((used, index) => (
                  <button
                    key={index}
                    type="button"
                    className={
                      state.wave === 1
                        ? used
                          ? "used"
                          : "unused"
                        : used
                          ? "remaining"
                          : "spent"
                    }
                    onClick={() => onNoviceToken(index)}
                    aria-label={`신참 토큰 ${index + 1}, ${
                      state.wave === 1
                        ? used
                          ? "소환됨"
                          : "미사용"
                        : used
                          ? "남음"
                          : "사용됨"
                    }`}
                  >
                    <img src={asset("/assets/heroes/novice.png")} alt="" />
                  </button>
                ))}
              </div>
            </article>
          )}
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

function StagePageDialog({
  stage,
  onClose,
}: {
  stage: Stage | null;
  onClose: () => void;
}) {
  if (!stage) return null;
  const pageImage = asset(
    `/assets/dungeon-pages/stage-${String(stage.page).padStart(2, "0")}.jpg`,
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="stage-page-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${stage.title} 던전 책자 ${stage.page}쪽`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>던전 책자 {stage.page}쪽</small>
            <h2>{stage.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="던전 책자 닫기">
            ×
          </button>
        </header>
        <img
          src={pageImage}
          alt={`${stage.title} 던전 책자 ${stage.page}쪽`}
        />
        <a href={pageImage} target="_blank" rel="noreferrer">
          이미지만 새 창에서 보기
        </a>
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
  if (!open) return null;

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
            <iframe
              title={`플레이어 룰북 ${page}쪽`}
              src={`${asset(
                "/rulebooks/player-rulebook.pdf",
              )}#page=${page}&view=FitH`}
            />
            <a
              href={`${asset(
                "/rulebooks/player-rulebook.pdf",
              )}#page=${page}&view=FitH`}
              target="_blank"
              rel="noreferrer"
            >
              새 창에서 크게 보기 ↗
            </a>
          </div>
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
              [stage.id]: stage.setup.map(() => false),
            }
          : previous.checklist,
      notes: "",
    }));
    setResumePlay(false);
  };

  const setDifficulty = (difficulty: Difficulty) => {
    update((previous) => ({ ...previous, difficulty }));
  };

  const prepareSetup = () => {
    const stage = stageById[state.stageId];
    update((previous) => ({
      ...previous,
      screen: "setup",
      checklist: {
        ...previous.checklist,
        [stage.id]: stage.setup.map(() => false),
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
      noviceTokens: previous.novicesEnabled
        ? Array.from(
            { length: difficulties[previous.difficulty].noviceCards },
            () => false,
          )
        : [],
      wave: 1,
      notes: "",
    }));
  };

  const toggleChecklist = (index: number) => {
    update((previous) => {
      const current =
        previous.checklist[previous.stageId] ??
        stageById[previous.stageId].setup.map(() => false);
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

  const resetForWaveTwo = () => {
    update((previous) => ({
      ...previous,
      wave: 2,
      heroTokens: freshHeroTokens(),
      eventTokens: previous.eventTokens.map(() => true),
      noviceTokens: previous.noviceTokens.map(() => true),
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
    const chapterCompleted =
      chapter?.stageIds.every((id) => nextCompletions[id]) ?? false;

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
            update((previous) => ({
              ...previous,
              completions: {
                ...previous.completions,
                [stageId]: !previous.completions[stageId],
              },
            }))
          }
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
          onNovices={(novicesEnabled) =>
            update((previous) => ({ ...previous, novicesEnabled }))
          }
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
          onNoviceToken={(index) => toggleArrayToken("noviceTokens", index)}
          onWaveReset={resetForWaveTwo}
          onBooklet={() => setStagePageOpen(activeStage)}
          onNotes={(notes) =>
            update((previous) => ({ ...previous, notes }))
          }
          onFail={() => finishGame(false)}
          onClear={() => finishGame(true)}
        />
      )}

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
          rewardChapter?.stageIds.every((id) => state.completions[id]) ?? false
        }
        announcement={rewardAnnouncement}
        onClose={closeReward}
      />
    </div>
  );
}
