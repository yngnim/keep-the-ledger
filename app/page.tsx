"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  chapters,
  chronologicalStages,
  rulebookSections,
  stageById,
  type Chapter,
  type Stage,
} from "./data";

type View = "chronicle" | "setup" | "play" | "records";
type Result = "win" | "loss" | null;
type Difficulty = "beginner" | "challenger" | "expert";
type TokenKey = "sword" | "eye" | "bone" | "hat" | "special";

type AppState = {
  currentStageId: number;
  results: Record<number, Result>;
  checklist: Record<number, boolean[]>;
  difficulty: Difficulty;
  wave: 1 | 2;
  tokenStart: Record<TokenKey, number>;
  tokenRemaining: Record<TokenKey, number>;
  notes: string;
  updatedAt: string;
};

const STORAGE_KEY = "keep-the-ledger:v1";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const initialTokens: Record<TokenKey, number> = {
  sword: 3,
  eye: 3,
  bone: 3,
  hat: 3,
  special: 2,
};

const defaultState: AppState = {
  currentStageId: 1,
  results: {},
  checklist: {},
  difficulty: "beginner",
  wave: 1,
  tokenStart: initialTokens,
  tokenRemaining: initialTokens,
  notes: "",
  updatedAt: new Date(0).toISOString(),
};

const tokenMeta: Array<{
  key: TokenKey;
  label: string;
  rooms: string;
  icon: string;
  tone: string;
}> = [
  {
    key: "sword",
    label: "검",
    rooms: "대장간 · 공방",
    icon: "/assets/icons/sword.svg",
    tone: "coral",
  },
  {
    key: "eye",
    label: "신비한 눈",
    rooms: "묘지 · 서재",
    icon: "/assets/icons/eye.svg",
    tone: "violet",
  },
  {
    key: "bone",
    label: "뼈",
    rooms: "하수도 · 야수 조련실",
    icon: "/assets/icons/bone.svg",
    tone: "mint",
  },
  {
    key: "hat",
    label: "모자",
    rooms: "도서관 · 약제실",
    icon: "/assets/icons/hat.svg",
    tone: "sky",
  },
  {
    key: "special",
    label: "시나리오",
    rooms: "이벤트 · 특수 카드",
    icon: "/assets/icons/special.png",
    tone: "amber",
  },
];

const viewMeta: Array<{
  id: View;
  label: string;
  short: string;
  glyph: string;
}> = [
  { id: "chronicle", label: "연대기", short: "연대기", glyph: "◆" },
  { id: "setup", label: "던전 세팅", short: "세팅", glyph: "⌘" },
  { id: "play", label: "플레이 보조", short: "플레이", glyph: "✦" },
  { id: "records", label: "기록 보관소", short: "기록", glyph: "▤" },
];

const difficultyMeta: Record<
  Difficulty,
  { label: string; wave1: number; wave2: number }
> = {
  beginner: { label: "초심자", wave1: 1, wave2: 2 },
  challenger: { label: "도전자", wave1: 2, wave2: 2 },
  expert: { label: "전문가", wave1: 2, wave2: 3 },
};

function asset(path: string) {
  return `${BASE_PATH}${path}`;
}

function getChronologyPosition(stageId: number) {
  return chronologicalStages.findIndex((stage) => stage.id === stageId);
}

function getChapter(stageId: number) {
  return chapters.find((chapter) => chapter.stageIds.includes(stageId))!;
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "첫 저장 전";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function AppIcon({ path, alt = "" }: { path: string; alt?: string }) {
  return <img className="app-icon" src={asset(path)} alt={alt} />;
}

function ChapterProgress({
  chapter,
  state,
}: {
  chapter: Chapter;
  state: AppState;
}) {
  const completed = chapter.stageIds.filter((id) => state.results[id]).length;
  return (
    <span className="chapter-progress" aria-label={`${completed}/4 완료`}>
      {chapter.stageIds.map((id) => (
        <i
          key={id}
          className={state.results[id] ? `done ${state.results[id]}` : ""}
        />
      ))}
    </span>
  );
}

function RulebookDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = rulebookSections.filter((section) =>
    `${section.title} ${section.detail}`.includes(query.trim()),
  );
  const pdfUrl = `${asset("/rulebooks/player-rulebook.pdf")}#page=${page}&view=FitH`;

  if (!open) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="rulebook-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="통합 플레이어 룰북"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <p className="eyebrow">언제든 꺼내 보는</p>
            <h2>통합 플레이어 룰북</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="룰북 닫기"
            data-testid="close-rulebook"
          >
            ×
          </button>
        </header>
        <div className="rulebook-layout">
          <aside className="rulebook-index">
            <label className="search-field">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="규칙 이름 찾기"
                aria-label="룰북 색인 검색"
              />
            </label>
            <div className="rulebook-cover">
              <img
                src={asset("/assets/rulebook-cover-01.jpg")}
                alt="통합 플레이어 룰북 표지"
              />
              <div>
                <strong>35쪽 통합본</strong>
                <span>기본 · 보스 배틀 · 길드 마스터</span>
              </div>
            </div>
            <nav className="rulebook-section-list" aria-label="룰북 바로가기">
              {filtered.map((section) => (
                <button
                  key={section.title}
                  className={page === section.page ? "active" : ""}
                  type="button"
                  onClick={() => setPage(section.page)}
                >
                  <span>
                    <strong>{section.title}</strong>
                    <small>{section.detail}</small>
                  </span>
                  <b>{section.page}</b>
                </button>
              ))}
            </nav>
            <a
              className="secondary-button full"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              새 창에서 크게 보기 ↗
            </a>
          </aside>
          <div className="pdf-stage">
            <div className="pdf-stage-bar">
              <span>{page}쪽부터 보기</span>
              <span>PDF</span>
            </div>
            <iframe title="통합 플레이어 룰북 PDF" src={pdfUrl} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ChronicleView({
  state,
  selectedStage,
  onSelectStage,
  onResult,
  onSetCurrent,
  onGoSetup,
  onGoPlay,
}: {
  state: AppState;
  selectedStage: Stage;
  onSelectStage: (id: number) => void;
  onResult: (id: number, result: Result) => void;
  onSetCurrent: (id: number) => void;
  onGoSetup: () => void;
  onGoPlay: () => void;
}) {
  const current = stageById[state.currentStageId];
  const selectedChapter = getChapter(selectedStage.id);
  const position = getChronologyPosition(selectedStage.id);
  const selectedIndex = selectedChapter.stageIds.indexOf(selectedStage.id);
  const priorLosses = selectedChapter.stageIds
    .slice(0, selectedIndex)
    .filter((id) => state.results[id] === "loss").length;

  return (
    <div className="view chronicle-view">
      <section className="chronicle-hero">
        <div className="hero-copy">
          <p className="eyebrow">연대기 순서 · {position + 1}/20</p>
          <h1>
            영웅은 몰라도,
            <br />
            <em>우리는 순서를 안다.</em>
          </h1>
          <p className="hero-description">
            기본 번호가 아닌 공식 연대기 다섯 챕터의 흐름대로 기록합니다.
            패배 페널티와 해금 능력도 다음 게임까지 이어집니다.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onGoPlay}>
              현재 게임 이어하기
              <span>시나리오 {current.id}</span>
            </button>
            <button
              className="text-button"
              type="button"
              onClick={onGoSetup}
            >
              세팅부터 확인 →
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="room-card room-one">
            <img src={asset("/assets/rooms/library.png")} alt="" />
          </div>
          <div className="room-card room-two">
            <img src={asset("/assets/rooms/treasury.png")} alt="" />
          </div>
          <div className="room-card room-three">
            <img src={asset("/assets/rooms/sewer.png")} alt="" />
          </div>
          <div className="quest-seal">
            <small>현재 원정</small>
            <strong>{String(current.id).padStart(2, "0")}</strong>
            <span>{current.title}</span>
          </div>
        </div>
      </section>

      <section className="timeline-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE CHRONICLE</p>
            <h2>다섯 개의 챕터</h2>
          </div>
          <p>점을 누르면 시나리오 장부가 열립니다.</p>
        </div>
        <div className="chapter-timeline">
          {chapters.map((chapter) => {
            const unlocked =
              state.results[chapter.stageIds[chapter.stageIds.length - 1]] ===
              "win";
            return (
              <article className="chapter-row" key={chapter.id}>
                <header>
                  <span className="chapter-number">0{chapter.id}</span>
                  <div>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.subtitle}</p>
                  </div>
                  <ChapterProgress chapter={chapter} state={state} />
                </header>
                <div className="stage-rail">
                  {chapter.stageIds.map((id, index) => {
                    const stage = stageById[id];
                    const result = state.results[id];
                    const isCurrent = state.currentStageId === id;
                    const isSelected = selectedStage.id === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectStage(id)}
                        className={[
                          "stage-stop",
                          result ?? "",
                          isCurrent ? "current" : "",
                          isSelected ? "selected" : "",
                        ].join(" ")}
                        aria-label={`연대기 ${chapter.id}장 ${index + 1}, 시나리오 ${id} ${stage.title}`}
                        data-testid={`stage-${id}`}
                      >
                        <i>{result === "win" ? "✓" : result === "loss" ? "×" : id}</i>
                        <span>
                          <small>{index + 1}막</small>
                          <strong>{stage.title}</strong>
                        </span>
                      </button>
                    );
                  })}
                  <div className={`reward-node ${unlocked ? "unlocked" : ""}`}>
                    <i>{unlocked ? "✦" : "◇"}</i>
                    <span>
                      <small>{unlocked ? "해금 완료" : "챕터 보상"}</small>
                      <strong>{chapter.reward}</strong>
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ledger-detail">
        <div className="detail-number" aria-hidden="true">
          {String(selectedStage.id).padStart(2, "0")}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {selectedChapter.id}장 · {selectedIndex + 1}막
          </p>
          <h2>{selectedStage.title}</h2>
          <p>{selectedStage.story}</p>
          <div className="tag-row">
            {selectedStage.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="detail-status">
          <p>결과 기록</p>
          <div className="result-segment" data-testid="result-controls">
            <button
              type="button"
              className={state.results[selectedStage.id] === "win" ? "active win" : ""}
              onClick={() => onResult(selectedStage.id, "win")}
            >
              승리
            </button>
            <button
              type="button"
              className={state.results[selectedStage.id] === "loss" ? "active loss" : ""}
              onClick={() => onResult(selectedStage.id, "loss")}
            >
              패배
            </button>
            <button
              type="button"
              className={!state.results[selectedStage.id] ? "active" : ""}
              onClick={() => onResult(selectedStage.id, null)}
            >
              미정
            </button>
          </div>
          <div className="penalty-note">
            <span>다음 시작 페널티</span>
            <strong>−{priorLosses}장</strong>
            <small>이 챕터에서 앞서 패배한 횟수</small>
          </div>
          {state.currentStageId !== selectedStage.id && (
            <button
              type="button"
              className="secondary-button full"
              onClick={() => onSetCurrent(selectedStage.id)}
            >
              현재 원정으로 설정
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function StageSelector({
  selectedId,
  onSelect,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="stage-selector" aria-label="연대기 시나리오 선택">
      {chapters.map((chapter) => (
        <div className="stage-selector-group" key={chapter.id}>
          <small>{chapter.id}장</small>
          {chapter.stageIds.map((id) => (
            <button
              type="button"
              key={id}
              className={selectedId === id ? "active" : ""}
              onClick={() => onSelect(id)}
              aria-label={`시나리오 ${id} ${stageById[id].title}`}
            >
              {id}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function SetupView({
  state,
  selectedStage,
  onSelectStage,
  onToggleChecklist,
  onSetCurrent,
  onGoPlay,
}: {
  state: AppState;
  selectedStage: Stage;
  onSelectStage: (id: number) => void;
  onToggleChecklist: (stageId: number, index: number) => void;
  onSetCurrent: (id: number) => void;
  onGoPlay: () => void;
}) {
  const checks = state.checklist[selectedStage.id] ?? [];
  const complete = selectedStage.setup.every((_, index) => checks[index]);
  const chapter = getChapter(selectedStage.id);

  return (
    <div className="view setup-view">
      <header className="page-intro">
        <div>
          <p className="eyebrow">DUNGEON SETUP</p>
          <h1>책자를 펼치기 전에,<br />필요한 것만 정확히.</h1>
        </div>
        <p>
          연대기 순서로 시나리오를 고르면 스토리, 금지 클랜, 준비물,
          특수 규칙과 던전책자 원문이 한 화면에 맞춰집니다.
        </p>
      </header>

      <StageSelector
        selectedId={selectedStage.id}
        onSelect={onSelectStage}
      />

      <section className="setup-stage">
        <div className="page-preview">
          <div className="page-preview-frame">
            <img
              src={asset(
                `/assets/dungeon-pages/stage-${String(selectedStage.page).padStart(2, "0")}.jpg`,
              )}
              alt={`던전 책자 ${selectedStage.page}쪽 ${selectedStage.title}`}
            />
          </div>
          <a
            className="page-link"
            href={`${asset("/rulebooks/dungeon-book.pdf")}#page=${selectedStage.page}&view=FitH`}
            target="_blank"
            rel="noreferrer"
          >
            던전책자 {selectedStage.page}쪽 열기
            <span>↗</span>
          </a>
        </div>

        <div className="setup-content">
          <div className="scenario-title">
            <span>{String(selectedStage.id).padStart(2, "0")}</span>
            <div>
              <p>{chapter.id}장 · {chapter.title}</p>
              <h2>{selectedStage.title}</h2>
            </div>
          </div>
          <p className="story-lead">{selectedStage.story}</p>
          <div className="gimmick-banner">
            <span>이번 판의 핵심</span>
            <strong>{selectedStage.highlight}</strong>
          </div>

          {selectedStage.clanBan && (
            <div className="ban-notice">
              <span>선택 불가 클랜</span>
              <strong>{selectedStage.clanBan}</strong>
            </div>
          )}

          <div className="setup-columns">
            <section className="checklist-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">PRE-FLIGHT</p>
                  <h3>세팅 체크리스트</h3>
                </div>
                <span className={complete ? "complete" : ""}>
                  {checks.filter(Boolean).length}/{selectedStage.setup.length}
                </span>
              </div>
              <div className="checklist">
                {selectedStage.setup.map((item, index) => (
                  <label key={item} className={checks[index] ? "checked" : ""}>
                    <input
                      type="checkbox"
                      checked={Boolean(checks[index])}
                      onChange={() =>
                        onToggleChecklist(selectedStage.id, index)
                      }
                    />
                    <i>{checks[index] ? "✓" : index + 1}</i>
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rules-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LIVE RULES</p>
                  <h3>기믹 미리보기</h3>
                </div>
              </div>
              <div className="compact-rules">
                {selectedStage.rules.map((rule) => (
                  <article key={`${rule.kind}-${rule.title}`}>
                    <span data-kind={rule.kind}>{rule.kind}</span>
                    <div>
                      <strong>{rule.title}</strong>
                      <p>{rule.text}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="setup-actions">
            {state.currentStageId !== selectedStage.id && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => onSetCurrent(selectedStage.id)}
              >
                현재 원정으로 설정
              </button>
            )}
            <button className="primary-button" type="button" onClick={onGoPlay}>
              {complete ? "세팅 완료 · 플레이 시작" : "플레이 보조로 이동"}
              <span>기록 자동 저장</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlayView({
  state,
  currentStage,
  onDifficulty,
  onWave,
  onConsumeToken,
  onAdjustToken,
  onSaveTokenStart,
  onResetWave,
  onNotes,
  onOpenRulebook,
}: {
  state: AppState;
  currentStage: Stage;
  onDifficulty: (difficulty: Difficulty) => void;
  onWave: (wave: 1 | 2) => void;
  onConsumeToken: (key: TokenKey) => void;
  onAdjustToken: (key: TokenKey, delta: number) => void;
  onSaveTokenStart: () => void;
  onResetWave: () => void;
  onNotes: (value: string) => void;
  onOpenRulebook: () => void;
}) {
  const [editingTokens, setEditingTokens] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(true);
  const drawCount =
    state.wave === 1
      ? difficultyMeta[state.difficulty].wave1
      : difficultyMeta[state.difficulty].wave2;
  const remainingTotal = Object.values(state.tokenRemaining).reduce(
    (sum, value) => sum + value,
    0,
  );
  const startTotal = Object.values(state.tokenStart).reduce(
    (sum, value) => sum + value,
    0,
  );
  const exhaustedTotal = Math.max(0, startTotal - remainingTotal);

  return (
    <div className="view play-view">
      <header className="play-header">
        <div>
          <p className="eyebrow">LIVE AT THE TABLE</p>
          <h1>테이블 위는 게임만.<br />계산은 장부에게.</h1>
        </div>
        <button
          className="rulebook-trigger"
          type="button"
          onClick={onOpenRulebook}
          data-testid="open-rulebook"
        >
          <span>▤</span>
          통합 룰북
          <small>언제든 열기</small>
        </button>
      </header>

      <section className="play-command">
        <div className="wave-control">
          <div className="control-title">
            <span>현재 습격</span>
            <strong>길드 카드 {drawCount}장</strong>
          </div>
          <div className="difficulty-control">
            {(Object.keys(difficultyMeta) as Difficulty[]).map((key) => (
              <button
                type="button"
                key={key}
                className={state.difficulty === key ? "active" : ""}
                onClick={() => onDifficulty(key)}
              >
                {difficultyMeta[key].label}
              </button>
            ))}
          </div>
          <div className="wave-switch">
            <button
              type="button"
              className={state.wave === 1 ? "active" : ""}
              onClick={() => onWave(1)}
            >
              <span>웨이브</span>
              <strong>1</strong>
            </button>
            <i>→</i>
            <button
              type="button"
              className={state.wave === 2 ? "active" : ""}
              onClick={() => onWave(2)}
            >
              <span>웨이브</span>
              <strong>2</strong>
            </button>
          </div>
        </div>

        <div className="current-gimmick">
          <div className="gimmick-index">
            <span>시나리오</span>
            <strong>{String(currentStage.id).padStart(2, "0")}</strong>
          </div>
          <div>
            <p>{currentStage.title}</p>
            <h2>{currentStage.highlight}</h2>
            <div className="tag-row">
              {currentStage.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <a
            href={`${asset("/rulebooks/dungeon-book.pdf")}#page=${currentStage.page}&view=FitH`}
            target="_blank"
            rel="noreferrer"
          >
            책자 {currentStage.page}쪽 ↗
          </a>
        </div>
      </section>

      <section className="token-board" data-testid="token-board">
        <header>
          <div>
            <p className="eyebrow">UNDERGROUND MARKET</p>
            <h2>침입 토큰 카운터</h2>
            <p>
              길드 카드를 공개하면 일치하는 방 기호를 누르세요. 남은 길드
              카드의 방향이 바로 보입니다.
            </p>
          </div>
          <div className="token-summary">
            <span>
              남음 <strong>{remainingTotal}</strong>
            </span>
            <i />
            <span>
              소진 <strong>{exhaustedTotal}</strong>
            </span>
          </div>
        </header>

        <div className="token-lanes">
          {tokenMeta.map((token) => {
            const remaining = state.tokenRemaining[token.key];
            const exhausted = Math.max(
              0,
              state.tokenStart[token.key] - remaining,
            );
            return (
              <article
                className={`token-lane ${token.tone}`}
                key={token.key}
                data-testid={`token-${token.key}`}
              >
                <div className="token-label">
                  <span className="token-symbol">
                    <AppIcon path={token.icon} alt="" />
                  </span>
                  <div>
                    <strong>{token.label}</strong>
                    <small>{token.rooms}</small>
                  </div>
                </div>
                {editingTokens ? (
                  <div className="token-editor">
                    <button
                      type="button"
                      onClick={() => onAdjustToken(token.key, -1)}
                      aria-label={`${token.label} 시작 수량 줄이기`}
                    >
                      −
                    </button>
                    <strong>{remaining}</strong>
                    <button
                      type="button"
                      onClick={() => onAdjustToken(token.key, 1)}
                      aria-label={`${token.label} 시작 수량 늘리기`}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="token-tap"
                    type="button"
                    onClick={() => onConsumeToken(token.key)}
                    disabled={remaining === 0}
                    aria-label={`${token.label} 침입 토큰 소진, ${remaining}개 남음`}
                  >
                    <span>남음</span>
                    <strong>{remaining}</strong>
                    <small>탭하여 소진</small>
                  </button>
                )}
                <div className="spent-pips" aria-label={`${exhausted}개 소진`}>
                  {Array.from({
                    length: Math.min(state.tokenStart[token.key], 8),
                  }).map((_, index) => (
                    <i
                      key={index}
                      className={index < exhausted ? "spent" : ""}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="token-board-footer">
          <p>
            {editingTokens
              ? "시장 매트에 실제로 놓은 토큰 수와 같게 맞추세요."
              : "신참 토큰은 웨이브 1에 별도로 소진 더미에 추가합니다."}
          </p>
          <div>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                if (editingTokens) onSaveTokenStart();
                setEditingTokens((value) => !value);
              }}
            >
              {editingTokens ? "시작 수량 저장" : "시작 수량 맞추기"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onResetWave}
            >
              웨이브 토큰 복귀
            </button>
          </div>
        </footer>
      </section>

      <section className="live-rules">
        <header>
          <div>
            <p className="eyebrow">STAGE MECHANICS</p>
            <h2>지금 적용 중인 기믹</h2>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => setRulesOpen((value) => !value)}
          >
            {rulesOpen ? "접기 ↑" : "펼치기 ↓"}
          </button>
        </header>
        {rulesOpen && (
          <div className="live-rule-grid">
            {currentStage.rules.map((rule, index) => (
              <article key={`${rule.kind}-${rule.title}`}>
                <span className="rule-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <small data-kind={rule.kind}>{rule.kind}</small>
                  <h3>{rule.title}</h3>
                  <p>{rule.text}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="table-notes">
        <div>
          <p className="eyebrow">SCRATCHPAD</p>
          <h2>이번 판 메모</h2>
          <p>남은 자원, 잊기 쉬운 발동 조건, 다음 차례 계획을 적어 두세요.</p>
        </div>
        <textarea
          value={state.notes}
          onChange={(event) => onNotes(event.target.value)}
          placeholder="예: 금고 동전 2개 유지 · 다음 사서 카드 전에 책 1개 이동"
          aria-label="이번 판 메모"
        />
      </section>

      <button
        className="floating-rulebook"
        type="button"
        onClick={onOpenRulebook}
        aria-label="통합 룰북 열기"
      >
        ▤ <span>룰북</span>
      </button>
    </div>
  );
}

function RecordsView({
  state,
  onExport,
  onImport,
  onRequestReset,
}: {
  state: AppState;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onRequestReset: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const wins = Object.values(state.results).filter((value) => value === "win").length;
  const losses = Object.values(state.results).filter(
    (value) => value === "loss",
  ).length;
  const unlocked = chapters.filter(
    (chapter) =>
      state.results[chapter.stageIds[chapter.stageIds.length - 1]] === "win",
  );

  return (
    <div className="view records-view">
      <header className="page-intro">
        <div>
          <p className="eyebrow">THE ARCHIVE</p>
          <h1>기록은 남고,<br />던전은 계속된다.</h1>
        </div>
        <p>
          모든 진행 상황은 이 기기에 자동 저장됩니다. 다른 기기로 옮기거나
          브라우저 데이터를 정리하기 전에는 백업 파일을 받아 두세요.
        </p>
      </header>

      <section className="record-stats">
        <article>
          <span>완료한 원정</span>
          <strong>{wins + losses}<small>/20</small></strong>
        </article>
        <article>
          <span>승리</span>
          <strong>{wins}</strong>
        </article>
        <article>
          <span>패배</span>
          <strong>{losses}</strong>
        </article>
        <article>
          <span>해금 능력</span>
          <strong>{unlocked.length}<small>/5</small></strong>
        </article>
      </section>

      <section className="archive-grid">
        <div className="rewards-archive">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">CHAPTER REWARDS</p>
              <h2>해금한 능력</h2>
            </div>
          </div>
          <div className="reward-list">
            {chapters.map((chapter) => {
              const isUnlocked = unlocked.some((item) => item.id === chapter.id);
              return (
                <article
                  key={chapter.id}
                  className={isUnlocked ? "unlocked" : ""}
                >
                  <i>{isUnlocked ? "✦" : "◇"}</i>
                  <div>
                    <small>{chapter.id}장 · {chapter.title}</small>
                    <h3>{chapter.reward}</h3>
                    <p>{chapter.rewardText}</p>
                  </div>
                  <span>{isUnlocked ? "해금" : "잠김"}</span>
                </article>
              );
            })}
          </div>
        </div>

        <div className="backup-panel">
          <p className="eyebrow">SAFE KEEPING</p>
          <h2>진행 기록 백업</h2>
          <p>
            자동 저장은 현재 브라우저에 남습니다. 백업 파일 하나면 컴퓨터,
            아이패드, 모바일 사이에서도 기록을 옮길 수 있습니다.
          </p>
          <div className="backup-illustration" aria-hidden="true">
            <div className="save-orb">✓</div>
            <span>마지막 저장</span>
            <strong>{formatSavedAt(state.updatedAt)}</strong>
          </div>
          <button className="primary-button full" type="button" onClick={onExport}>
            백업 파일 내보내기
            <span>JSON · 개인 기기에 저장</span>
          </button>
          <button
            className="secondary-button full"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            백업 파일 가져오기
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={onImport}
          />
          <button
            className="danger-text-button"
            type="button"
            onClick={onRequestReset}
          >
            모든 기록 초기화
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("chronicle");
  const [state, setState] = useState<AppState>(defaultState);
  const [selectedStageId, setSelectedStageId] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [rulebookOpen, setRulebookOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let hydratedState = defaultState;
    let hydratedStageId = 1;
    let hydrationMessage = "";

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppState>;
        hydratedState = {
          ...defaultState,
          ...parsed,
          tokenStart: { ...initialTokens, ...parsed.tokenStart },
          tokenRemaining: { ...initialTokens, ...parsed.tokenRemaining },
        };
        if (parsed.currentStageId) hydratedStageId = parsed.currentStageId;
      }
    } catch {
      hydrationMessage = "저장 기록을 읽지 못해 새 장부로 시작했습니다.";
    }

    const frame = window.requestAnimationFrame(() => {
      setState(hydratedState);
      setSelectedStageId(hydratedStageId);
      if (hydrationMessage) setToast(hydrationMessage);
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
  }, [state, loaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  const selectedStage = stageById[selectedStageId] ?? stageById[1];
  const currentStage = stageById[state.currentStageId] ?? stageById[1];
  const completed = useMemo(
    () => Object.values(state.results).filter(Boolean).length,
    [state.results],
  );

  const update = (recipe: (previous: AppState) => AppState) => {
    setState((previous) => ({
      ...recipe(previous),
      updatedAt: new Date().toISOString(),
    }));
  };

  const setCurrentStage = (id: number) => {
    update((previous) => ({
      ...previous,
      currentStageId: id,
      notes: previous.currentStageId === id ? previous.notes : "",
    }));
    setSelectedStageId(id);
    setToast(`시나리오 ${id}을 현재 원정으로 설정했습니다.`);
  };

  const setResult = (id: number, result: Result) => {
    update((previous) => ({
      ...previous,
      results: { ...previous.results, [id]: result },
    }));
  };

  const toggleChecklist = (stageId: number, index: number) => {
    update((previous) => {
      const next = [...(previous.checklist[stageId] ?? [])];
      next[index] = !next[index];
      return {
        ...previous,
        checklist: { ...previous.checklist, [stageId]: next },
      };
    });
  };

  const consumeToken = (key: TokenKey) => {
    update((previous) => ({
      ...previous,
      tokenRemaining: {
        ...previous.tokenRemaining,
        [key]: Math.max(0, previous.tokenRemaining[key] - 1),
      },
    }));
  };

  const adjustToken = (key: TokenKey, delta: number) => {
    update((previous) => ({
      ...previous,
      tokenRemaining: {
        ...previous.tokenRemaining,
        [key]: Math.max(0, Math.min(20, previous.tokenRemaining[key] + delta)),
      },
    }));
  };

  const saveTokenStart = () => {
    update((previous) => ({
      ...previous,
      tokenStart: { ...previous.tokenRemaining },
    }));
    setToast("현재 수량을 웨이브 시작값으로 저장했습니다.");
  };

  const resetWave = () => {
    update((previous) => ({
      ...previous,
      tokenRemaining: { ...previous.tokenStart },
    }));
    setToast("모든 침입 토큰을 시작 위치로 되돌렸습니다.");
  };

  const exportState = () => {
    const payload = {
      app: "Keep the Ledger",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `keep-the-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("진행 기록 백업 파일을 만들었습니다.");
  };

  const importState = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as {
        version?: number;
        state?: AppState;
      };
      if (payload.version !== 1 || !payload.state?.currentStageId) {
        throw new Error("invalid");
      }
      setState({
        ...defaultState,
        ...payload.state,
        tokenStart: { ...initialTokens, ...payload.state.tokenStart },
        tokenRemaining: { ...initialTokens, ...payload.state.tokenRemaining },
      });
      setSelectedStageId(payload.state.currentStageId);
      setToast("백업 기록을 안전하게 불러왔습니다.");
    } catch {
      setToast("이 앱에서 만든 올바른 백업 파일이 아닙니다.");
    }
    event.target.value = "";
  };

  const resetState = () => {
    setState({ ...defaultState, updatedAt: new Date().toISOString() });
    setSelectedStageId(1);
    setResetOpen(false);
    setToast("새 장부로 초기화했습니다.");
  };

  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <button
          className="brand-mark"
          type="button"
          onClick={() => setView("chronicle")}
          aria-label="Keep the Ledger 홈"
        >
          <span>K</span>
          <i />
        </button>
        <nav aria-label="주요 메뉴">
          {viewMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "active" : ""}
              onClick={() => setView(item.id)}
            >
              <span>{item.glyph}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>
        <div className="rail-progress">
          <span>{completed}</span>
          <small>/ 20</small>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <button
            className="wordmark"
            type="button"
            onClick={() => setView("chronicle")}
          >
            <span>KEEP THE LEDGER</span>
            <small>던전 원정 장부</small>
          </button>
          <div className="topbar-status">
            <span className="autosave-dot" />
            <span>
              자동 저장
              <small>{formatSavedAt(state.updatedAt)}</small>
            </span>
          </div>
        </header>

        <main>
          {view === "chronicle" && (
            <ChronicleView
              state={state}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStageId}
              onResult={setResult}
              onSetCurrent={setCurrentStage}
              onGoSetup={() => {
                setSelectedStageId(state.currentStageId);
                setView("setup");
              }}
              onGoPlay={() => setView("play")}
            />
          )}
          {view === "setup" && (
            <SetupView
              state={state}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStageId}
              onToggleChecklist={toggleChecklist}
              onSetCurrent={setCurrentStage}
              onGoPlay={() => {
                if (state.currentStageId !== selectedStage.id) {
                  setCurrentStage(selectedStage.id);
                }
                setView("play");
              }}
            />
          )}
          {view === "play" && (
            <PlayView
              state={state}
              currentStage={currentStage}
              onDifficulty={(difficulty) =>
                update((previous) => ({ ...previous, difficulty }))
              }
              onWave={(wave) => update((previous) => ({ ...previous, wave }))}
              onConsumeToken={consumeToken}
              onAdjustToken={adjustToken}
              onSaveTokenStart={saveTokenStart}
              onResetWave={resetWave}
              onNotes={(notes) =>
                update((previous) => ({ ...previous, notes }))
              }
              onOpenRulebook={() => setRulebookOpen(true)}
            />
          )}
          {view === "records" && (
            <RecordsView
              state={state}
              onExport={exportState}
              onImport={importState}
              onRequestReset={() => setResetOpen(true)}
            />
          )}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {viewMeta.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? "active" : ""}
            onClick={() => setView(item.id)}
          >
            <span>{item.glyph}</span>
            <small>{item.short}</small>
          </button>
        ))}
      </nav>

      <RulebookDrawer
        open={rulebookOpen}
        onClose={() => setRulebookOpen(false)}
      />

      {resetOpen && (
        <div className="confirm-backdrop" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-label="기록 초기화 확인">
            <span className="warning-mark">!</span>
            <h2>장부를 처음부터 시작할까요?</h2>
            <p>연대기 결과, 세팅 체크, 토큰 수량과 메모가 모두 지워집니다.</p>
            <div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setResetOpen(false)}
              >
                취소
              </button>
              <button className="danger-button" type="button" onClick={resetState}>
                모두 초기화
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
