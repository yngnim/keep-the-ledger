# Keep the Ledger

`Keep the Heroes Out` 캠페인을 위한 반응형 플레이 컴패니언입니다.

- 기본판 20개와 보스 배틀 10개를 공식 연대기 순서로 진행
- 본편과 분리된 연말 특선 H1–H3 추가 시나리오
- 시나리오별 이야기, 던전 세팅 체크리스트, 기믹, 책자 페이지
- 지하 시장 침입 토큰 카운터와 웨이브 복귀
- 35쪽 통합 플레이어 룰북의 빠른 색인과 PDF 열람
- 브라우저 자동 저장, JSON 백업/복원, 오프라인 앱 셸
- 데스크톱, iPad, 모바일 반응형 레이아웃

## 로컬 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev
```

## 검증

```bash
npm test
npm run lint
```

`npm test`는 Sites용 빌드와 GitHub Pages용 정적 빌드를 모두 만들고 핵심
콘텐츠와 배포 자산을 확인합니다.

## GitHub Pages 배포

저장소의 기본 브랜치를 `main`으로 두고 GitHub의 **Settings → Pages →
Source**를 **GitHub Actions**로 선택합니다. 이후 `main`에 푸시하면
`.github/workflows/deploy-pages.yml`이 `out/` 정적 사이트를 자동 배포합니다.

프로젝트 저장소가 `username.github.io`가 아니어도 저장소 이름을
`basePath`로 자동 적용합니다.

## 진행 기록

진행 기록은 현재 브라우저의 로컬 저장소에 자동 보관됩니다. 기록
보관소에서 JSON 백업을 내려받아 다른 기기나 브라우저로 옮길 수 있습니다.
