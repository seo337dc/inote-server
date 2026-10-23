import { PrismaClient } from '@prisma/client';
import {
  assertSafeTarget,
  describeTarget,
  formatSummary,
  parseBackfillArgs,
  runBackfill,
} from '../src/embeddings/embedding-backfill';
import { putPostEmbedding } from '../src/embeddings/inote-ai-embeddings';

// 기존 글 임베딩 백필 — 발행된 글(비공개 포함)을 하나씩 inote-ai에 보내 벡터를 채운다.
//
//   scripts/dev-db.sh backfill [--dry-run] [--limit N] [--only 글ID]       로컬 개발 DB → 로컬 AI 서버
//   pnpm embeddings:backfill --dry-run                                     .env의 DB·AI 서버 (원격이면 --allow-remote 필요)
//
// 자세한 사용법·안전장치: docs/runbooks/embeddings-backfill.md

async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));

  // 연결하기 전에 대상부터 확인한다 (로컬↔운영 짝이 어긋나면 여기서 멈춘다)
  assertSafeTarget(
    process.env.DATABASE_URL,
    process.env.INOTE_AI_URL,
    options.allowRemote,
  );
  const target = describeTarget(
    process.env.DATABASE_URL,
    process.env.INOTE_AI_URL,
  );
  console.log(`대상: BE DB ${target.db} → AI 서버 ${target.ai}`);
  console.log(
    `모드: ${options.dryRun ? 'dry-run(보내지 않음)' : '실행'}${options.limit ? ` · 최대 ${options.limit}개` : ''}${options.only ? ` · 글 ${options.only}만` : ''}`,
  );

  const prisma = new PrismaClient();
  let stop = false;
  process.on('SIGINT', () => {
    if (stop) process.exit(130); // 두 번 누르면 바로 종료
    stop = true;
    console.log(
      '\n중단 요청 — 지금 글까지만 하고 멈춥니다 (한 번 더 누르면 즉시 종료).',
    );
  });

  try {
    const where = {
      publishedAt: { not: null },
      ...(options.only ? { id: options.only } : {}),
    };
    const total = await prisma.post.count({ where });
    console.log(`대상 글(발행됨): ${total}개\n`);

    const summary = await runBackfill(options, {
      total,
      loadPage: (afterId, take) =>
        prisma.post.findMany({
          where,
          select: { id: true, title: true, content: true },
          orderBy: { id: 'asc' },
          take,
          ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
        }),
      send: (post) => putPostEmbedding(post.id, post.title, post.content),
      log: (line) => console.log(line),
      shouldStop: () => stop,
    });

    for (const line of formatSummary(summary, options.dryRun))
      console.log(line);
    if (summary.interrupted) process.exitCode = 130;
    else if (summary.failed.length > 0 || summary.aborted) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\n오류: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
