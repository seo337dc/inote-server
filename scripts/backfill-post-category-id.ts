import { PrismaClient } from '@prisma/client';
import {
  applyLinks,
  assertSafeTarget,
  describeTarget,
  formatPlan,
  parseBackfillArgs,
  planBackfill,
} from '../src/categories/post-category-backfill';

// 기존 글의 categoryId 채우기 — 작성자 카테고리 중 이름이 정확히 하나 맞는 글만 잇는다. 기본은 dry-run(아무것도 쓰지 않음).
//
//   scripts/dev-db.sh backfill-category [--apply] [--user ID]      로컬 개발 DB
//   pnpm post-category:backfill --allow-remote [--apply]           .env의 DB (원격이면 --allow-remote 필요)
//
// 자세한 사용법·안전장치: docs/runbooks/post-category-backfill.md

async function main() {
  const options = parseBackfillArgs(process.argv.slice(2));

  // 연결하기 전에 대상부터 확인한다 (원격이면 --allow-remote 없이는 여기서 멈춘다)
  assertSafeTarget(process.env.DATABASE_URL, options.allowRemote);
  console.log(`대상 DB: ${describeTarget(process.env.DATABASE_URL)}`);
  console.log(
    `모드: ${options.apply ? '실행(--apply: 실제로 씁니다)' : 'dry-run(아무것도 쓰지 않음)'}${options.userId ? ` · 사용자 ${options.userId}만` : ''}\n`,
  );

  const prisma = new PrismaClient();
  try {
    // 아직 카테고리가 지정되지 않은 글만 (이미 지정된 글은 건드리지 않으므로 여러 번 실행해도 안전)
    const posts = await prisma.post.findMany({
      where: {
        categoryId: null,
        ...(options.userId ? { userId: options.userId } : {}),
      },
      select: { id: true, title: true, userId: true, category: true },
      orderBy: { createdAt: 'asc' },
    });
    const userIds = [
      ...new Set(posts.flatMap((p) => (p.userId ? [p.userId] : []))),
    ];
    const categories = await prisma.postCategory.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true, name: true, parentId: true },
    });

    const plan = planBackfill(posts, categories);
    for (const line of formatPlan(plan, posts.length, options.apply)) {
      console.log(line);
    }

    if (!options.apply) {
      console.log(
        '\ndry-run이라 아무것도 쓰지 않았습니다. 실제로 이으려면 --apply를 붙이세요.',
      );
      return;
    }
    const updated = await applyLinks(plan.links, {
      updateMany: (args) => prisma.post.updateMany(args),
    });
    console.log(`\n${updated}개 글에 categoryId를 채웠습니다.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`\n오류: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
