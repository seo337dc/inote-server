import { isEmptyPost } from './inote-ai-embeddings';

// 기존 글 임베딩 백필 — 이미 발행된 글의 벡터를 inote-ai에 한 번에 채운다. 설계: inote 레포 docs/kure/PLAN.md (A6-5).
// 실행은 scripts/backfill-embeddings.ts. 여기는 DB·네트워크 없이 테스트할 수 있는 순수 로직만 둔다.
//
// 규칙
// - 발행된 글만(비공개 포함). 임시저장은 저장 훅도 임베딩하지 않으므로 같은 기준이다.
// - 제목도 본문도 빈 글은 건너뛴다(isEmptyPost, 저장 훅과 같은 기준).
// - 한 번에 하나씩(글 하나에 약 5초, inote-ai·임베딩 서비스에 부담을 주지 않는다).
// - 다시 실행해도 안전하다: 내용·모델이 같으면 inote-ai가 알아서 건너뛴다("unchanged").
// - 실패는 기록하고 다음 글로 넘어간다. 연속으로 5번 실패하면 서버가 죽었거나 비밀키가 틀린 것으로 보고 멈춘다.
// - 로그에는 글 id만 남긴다(제목·본문은 남기지 않는다).

export type BackfillOptions = {
  dryRun: boolean;
  limit?: number;
  only?: string;
  allowRemote: boolean;
};

export function parseBackfillArgs(argv: string[]): BackfillOptions {
  const options: BackfillOptions = { dryRun: false, allowRemote: false };
  const value = (name: string, i: number): [string, number] => {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    if (eq !== -1) return [arg.slice(eq + 1), i];
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`${name} 값이 필요합니다.`);
    }
    return [next, i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') continue; // pnpm이 스크립트 이름 뒤의 `--`를 그대로 넘겨 준다
    const name = argv[i].split('=')[0];
    if (name === '--dry-run') options.dryRun = true;
    else if (name === '--allow-remote') options.allowRemote = true;
    else if (name === '--limit') {
      const [v, next] = value(name, i);
      i = next;
      if (!/^[1-9]\d*$/.test(v)) {
        throw new Error('--limit은 1 이상의 정수여야 합니다.');
      }
      options.limit = Number(v);
    } else if (name === '--only') {
      const [v, next] = value(name, i);
      i = next;
      options.only = v;
    } else {
      throw new Error(`알 수 없는 옵션: ${argv[i]}`);
    }
  }
  return options;
}

// ── 안전장치: 이 스크립트가 "어느 BE DB의 글을 어느 AI 서버로 보내는지" 확인한다 ─────────
// 로컬 AI 서버나 로컬 DB를 쓰는 것 자체는 문제가 아니다. 문제는 짝이 어긋날 때다:
//  · 운영 BE DB → 로컬 AI: 운영 글(비공개 포함)이 이 PC의 AI 서버로 가서, 그 서버가 가리키는 DB(기본은 .env의 운영 AI DB)에 쌓인다
//  · 로컬 BE DB → 운영 AI: 개발용 시드 글의 벡터가 운영 AI DB에 섞인다
// 그래서 둘 다 로컬이면 그대로 실행하고, 둘 다 원격이면 --allow-remote를 줄 때만, 짝이 어긋나면 항상 거절한다.
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

function parseUrl(label: string, raw: string | undefined): URL {
  if (!raw) throw new Error(`${label}가 설정되어 있지 않습니다.`);
  try {
    return new URL(raw);
  } catch {
    throw new Error(`${label}가 올바른 주소가 아닙니다.`);
  }
}

/** 비밀번호 없이 "host:port/db" 꼴로 — 실행 전에 사람이 대상을 확인하도록 출력하는 용도 */
export function describeTarget(
  databaseUrl: string | undefined,
  aiUrl: string | undefined,
): { db: string; ai: string } {
  const db = parseUrl('DATABASE_URL', databaseUrl);
  const ai = parseUrl('INOTE_AI_URL', aiUrl);
  return {
    db: `${db.host}${db.pathname}`,
    ai: ai.host,
  };
}

export function assertSafeTarget(
  databaseUrl: string | undefined,
  aiUrl: string | undefined,
  allowRemote: boolean,
): void {
  const db = parseUrl('DATABASE_URL', databaseUrl);
  const ai = parseUrl('INOTE_AI_URL', aiUrl);
  const dbLocal = LOCAL_HOSTS.includes(db.hostname);
  const aiLocal = LOCAL_HOSTS.includes(ai.hostname);

  if (dbLocal !== aiLocal) {
    throw new Error(
      `BE DB(${dbLocal ? '로컬' : '원격'}: ${db.hostname})와 AI 서버(${aiLocal ? '로컬' : '원격'}: ${ai.hostname})의 짝이 맞지 않습니다. ` +
        '운영 글이 로컬 AI로 가거나 개발용 글이 운영 AI DB에 섞일 수 있어 실행하지 않습니다. ' +
        '둘 다 로컬이거나 둘 다 운영이어야 합니다(DATABASE_URL·INOTE_AI_URL 확인).',
    );
  }
  if (!dbLocal && !allowRemote) {
    throw new Error(
      `원격 대상입니다(DB host=${db.hostname}, AI host=${ai.hostname}). ` +
        '운영에 실제로 채우려면 --dry-run으로 먼저 확인한 뒤 --allow-remote를 붙여 실행하세요.',
    );
  }
}

// ── 실행 ────────────────────────────────────────────────────────────────────
export type BackfillPost = { id: string; title: string; content: string };

export type BackfillDeps = {
  /** 대상 글 수(발행된 글, 진행 표시용) */
  total: number;
  /** afterId(없으면 처음) 다음 글을 id 순으로 최대 take개 */
  loadPage: (afterId: string | null, take: number) => Promise<BackfillPost[]>;
  /** 글 하나를 inote-ai에 보낸다 — 실패하면 던진다 */
  send: (post: BackfillPost) => Promise<'embedded' | 'unchanged'>;
  log: (line: string) => void;
  /** true를 돌려주면 지금 글까지만 하고 멈춘다 (Ctrl+C용) */
  shouldStop?: () => boolean;
  now?: () => number;
};

export type BackfillSummary = {
  scanned: number;
  empty: number;
  /** dry-run에서 보냈을 글 수 */
  wouldSend: number;
  embedded: number;
  unchanged: number;
  failed: { id: string; error: string }[];
  /** 연속 실패로 중간에 멈췄는지 */
  aborted: boolean;
  /** 사용자가 중단했는지 */
  interrupted: boolean;
  elapsedMs: number;
};

export const PAGE_SIZE = 50;
export const MAX_CONSECUTIVE_FAILURES = 5;

export async function runBackfill(
  options: Pick<BackfillOptions, 'dryRun' | 'limit'>,
  deps: BackfillDeps,
): Promise<BackfillSummary> {
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  const summary: BackfillSummary = {
    scanned: 0,
    empty: 0,
    wouldSend: 0,
    embedded: 0,
    unchanged: 0,
    failed: [],
    aborted: false,
    interrupted: false,
    elapsedMs: 0,
  };
  let attempted = 0;
  let consecutiveFailures = 0;
  let afterId: string | null = null;

  paging: while (true) {
    const page = await deps.loadPage(afterId, PAGE_SIZE);
    if (page.length === 0) break;
    for (const post of page) {
      if (deps.shouldStop?.()) {
        summary.interrupted = true;
        break paging;
      }
      if (options.limit !== undefined && attempted >= options.limit)
        break paging;

      summary.scanned++;
      const progress = `[${summary.scanned}/${deps.total}] ${post.id}`;

      if (isEmpty(post)) {
        summary.empty++;
        deps.log(`${progress} - 건너뜀(제목·본문이 비어 있음)`);
        continue;
      }
      attempted++;
      if (options.dryRun) {
        summary.wouldSend++;
        deps.log(`${progress} - 보낼 예정(dry-run)`);
        continue;
      }

      const t0 = now();
      try {
        const result = await deps.send(post);
        const seconds = ((now() - t0) / 1000).toFixed(1);
        if (result === 'unchanged') summary.unchanged++;
        else summary.embedded++;
        consecutiveFailures = 0;
        deps.log(
          `${progress} ✓ ${result === 'unchanged' ? '변경 없음' : '임베딩'} (${seconds}s)`,
        );
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        summary.failed.push({ id: post.id, error });
        consecutiveFailures++;
        deps.log(`${progress} ✗ 실패: ${error}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          summary.aborted = true;
          deps.log(
            `연속 ${MAX_CONSECUTIVE_FAILURES}번 실패해서 멈춥니다. AI 서버·임베딩 서비스·INTERNAL_SECRET을 확인한 뒤 다시 실행하세요(이미 된 글은 건너뜁니다).`,
          );
          break paging;
        }
      }
    }
    afterId = page[page.length - 1].id;
    if (page.length < PAGE_SIZE) break;
  }

  summary.elapsedMs = now() - startedAt;
  return summary;
}

// 서비스의 저장 훅(blog.service.ts syncEmbedding)과 같은 기준 — isEmptyPost를 그대로 쓴다
function isEmpty(post: BackfillPost): boolean {
  return isEmptyPost(post.title, post.content);
}

export function formatSummary(
  summary: BackfillSummary,
  dryRun: boolean,
): string[] {
  const seconds = (summary.elapsedMs / 1000).toFixed(1);
  const lines = [
    '',
    `── 결과 (${seconds}s) ──`,
    `확인한 글: ${summary.scanned}개`,
  ];
  lines.push(`건너뜀(빈 글): ${summary.empty}개`);
  if (dryRun) {
    lines.push(
      `보낼 글: ${summary.wouldSend}개 (dry-run이라 아무것도 보내지 않았습니다)`,
    );
  } else {
    lines.push(`새로 임베딩: ${summary.embedded}개`);
    lines.push(`변경 없음: ${summary.unchanged}개`);
    lines.push(`실패: ${summary.failed.length}개`);
    for (const f of summary.failed) lines.push(`  - ${f.id}: ${f.error}`);
  }
  if (summary.aborted) lines.push('※ 연속 실패로 중간에 멈췄습니다.');
  if (summary.interrupted)
    lines.push('※ 중단했습니다. 다시 실행하면 이어서 채웁니다.');
  return lines;
}
