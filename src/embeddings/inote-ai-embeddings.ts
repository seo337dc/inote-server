import { Logger } from '@nestjs/common';

// 글 임베딩(KURE) — inote-ai의 /embeddings API를 부르는 함수들. 설계: inote 레포 docs/kure/PLAN.md.
// 기존 users/inote-ai-client.ts처럼 클래스 주입 없이 쓰는 일반 함수 모듈이다(호출하는 서비스의 생성자·테스트 모듈을 바꾸지 않으려고).
//
// 규칙
// - **글 저장·삭제를 절대 막지 않는다(fail-open)**: 켜져 있어도 실패(AI 서버 장애, 시간 초과, 이상한 응답)는 던지지 않고 경고만 남긴다.
//   호출하는 쪽은 `await` 하지 않아도 된다(저장 응답을 기다리게 하지 않는다 — 임베딩은 글 한 편에 약 5초 걸린다).
// - **EMBEDDINGS_ENABLED=true일 때만 동작한다**(기본 꺼짐). 꺼져 있으면 아무것도 하지 않는다 → AI 서버가 준비되기 전에 BE를 배포해도 동작이 같다.
// - **같은 글에 대한 호출은 들어온 순서대로 한 줄로 처리한다**(글 id별 큐). 저장 버튼을 연달아 누르면 요청이 겹쳐서, 예전 내용이 나중에
//   끝나 오래된 벡터가 남을 수 있기 때문이다. 한 줄로 세우면 마지막 저장이 항상 마지막에 반영되고, 삭제도 대기 중인 저장 뒤에 실행된다.
//   다른 글끼리는 서로 기다리지 않고 동시에 처리한다.
// - 로그에는 글 id와 오류 메시지만 남기고 **본문은 남기지 않는다**.

const defaultLogger = new Logger('InoteAiEmbeddings');

// inote-ai가 임베딩 서비스에 쓰는 시간 상한(40초)보다 조금 길게 — 그 안에서 AI 서버가 먼저 503으로 답할 수 있게
const REQUEST_TIMEOUT_MS = 45_000;

export function isEmbeddingsEnabled(): boolean {
  return process.env.EMBEDDINGS_ENABLED === 'true';
}

// 글 id → 그 글의 마지막 대기 호출. 끝나면 비운다(맵이 계속 자라지 않게).
const queues = new Map<string, Promise<void>>();

function enqueue(postId: string, task: () => Promise<void>): Promise<void> {
  const previous = queues.get(postId) ?? Promise.resolve();
  // task는 던지지 않으므로(아래 run에서 모두 잡는다) 앞 호출이 실패해도 다음 호출은 항상 이어서 실행된다
  const next = previous.then(task);
  queues.set(postId, next);
  void next.finally(() => {
    if (queues.get(postId) === next) queues.delete(postId);
  });
  return next;
}

/** 아직 끝나지 않은 호출이 있는 글의 수 (진단·테스트용) */
export function pendingEmbeddingPosts(): number {
  return queues.size;
}

// fetch는 연결 실패를 "fetch failed"로만 알려 주고 원인(ECONNREFUSED 등)은 cause에 있다 — 로그에서 알아볼 수 있게 붙인다
export function describeError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  const cause = (e as { cause?: { code?: string; message?: string } } | null)
    ?.cause;
  const detail = cause?.code ?? cause?.message;
  return detail ? `${message} (${detail})` : message;
}

async function run(
  action: string,
  postId: string,
  request: () => Promise<Response>,
  logger: Logger,
): Promise<void> {
  try {
    const res = await request();
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
  } catch (e) {
    logger.warn(
      `failed to ${action} embedding for post ${postId}: ${describeError(e)}`,
    );
  }
}

function baseUrl(
  logger: Logger,
  action: string,
  postId: string,
): string | null {
  const url = process.env.INOTE_AI_URL;
  if (!url) {
    logger.warn(
      `skip ${action} embedding for post ${postId}: INOTE_AI_URL is not set`,
    );
    return null;
  }
  return url.replace(/\/+$/, '');
}

export function internalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
  };
}

/**
 * 글의 벡터를 만들어 저장하도록 inote-ai에 요청한다 (PUT /embeddings/posts/{id}).
 * 내용·모델이 같으면 inote-ai가 알아서 건너뛴다. 꺼져 있으면 아무것도 하지 않는다. 절대 던지지 않는다.
 * 반환하는 Promise는 호출이 끝났을 때 resolve된다 — 기다릴 필요가 없으면 `void`로 버려도 안전하다.
 */
export function upsertPostEmbedding(
  postId: string,
  title: string,
  content: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  if (!isEmbeddingsEnabled()) return Promise.resolve();
  return enqueue(postId, () =>
    run(
      'update',
      postId,
      async () => {
        const url = baseUrl(logger, 'update', postId);
        if (!url) return new Response(null, { status: 200 }); // 주소가 없으면 이미 경고했고, 실패로 또 세지 않는다
        return fetch(`${url}/embeddings/posts/${encodeURIComponent(postId)}`, {
          method: 'PUT',
          headers: internalHeaders(),
          body: JSON.stringify({ title, content }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      },
      logger,
    ),
  );
}

/**
 * 글의 벡터를 지우도록 inote-ai에 요청한다 (DELETE /embeddings/posts/{id}). inote-ai는 없어도 오류로 치지 않는다.
 * 같은 글의 대기 중인 저장 호출이 있으면 그 뒤에 실행된다. 꺼져 있으면 아무것도 하지 않는다. 절대 던지지 않는다.
 */
export function deletePostEmbedding(
  postId: string,
  logger: Logger = defaultLogger,
): Promise<void> {
  if (!isEmbeddingsEnabled()) return Promise.resolve();
  return enqueue(postId, () =>
    run(
      'delete',
      postId,
      async () => {
        const url = baseUrl(logger, 'delete', postId);
        if (!url) return new Response(null, { status: 200 });
        return fetch(`${url}/embeddings/posts/${encodeURIComponent(postId)}`, {
          method: 'DELETE',
          headers: internalHeaders(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      },
      logger,
    ),
  );
}

/**
 * 여러 글의 벡터를 하나씩 차례로 지운다 — 사용자 삭제처럼 글이 수백~수천 개일 때
 * inote-ai에 요청이 한꺼번에 몰리지 않게 한다. 꺼져 있으면 아무것도 하지 않는다. 절대 던지지 않는다.
 */
export async function deletePostEmbeddings(
  postIds: string[],
  logger: Logger = defaultLogger,
): Promise<void> {
  if (!isEmbeddingsEnabled()) return;
  for (const postId of postIds) {
    await deletePostEmbedding(postId, logger);
  }
}

// blog.service.ts의 EMPTY_CONTENT와 같은 기준 — 빈 에디터가 남기는 본문
const EMPTY_CONTENT = ['', '<p></p>'];

/** 제목도 본문도 빈 글 — 임베딩할 내용이 없다. 저장 훅과 백필이 같은 기준을 쓴다. */
export function isEmptyPost(title: string, content: string): boolean {
  return !title.trim() && EMPTY_CONTENT.includes(content);
}

/**
 * 백필 스크립트용 — 글 하나의 벡터를 만들어 저장하도록 요청하고 결과를 돌려준다.
 * 위의 upsertPostEmbedding과 달리 **실패하면 던지고**(호출한 쪽이 실패 목록을 만들 수 있게),
 * EMBEDDINGS_ENABLED 스위치와 글별 큐를 거치지 않는다(백필은 스위치를 켜기 전에 돌리는 작업이기도 하다).
 */
export async function putPostEmbedding(
  postId: string,
  title: string,
  content: string,
): Promise<'embedded' | 'unchanged'> {
  const url = process.env.INOTE_AI_URL;
  if (!url) throw new Error('INOTE_AI_URL is not set');
  let res: Response;
  try {
    res = await fetch(
      `${url.replace(/\/+$/, '')}/embeddings/posts/${encodeURIComponent(postId)}`,
      {
        method: 'PUT',
        headers: internalHeaders(),
        body: JSON.stringify({ title, content }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch (e) {
    throw new Error(describeError(e));
  }
  if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
  const body = (await res.json()) as { status?: string };
  return body.status === 'unchanged' ? 'unchanged' : 'embedded';
}
