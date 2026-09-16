import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

type SeedItem = {
  theme: string;
  themeName: string;
  title: string;
  done: boolean;
  position: number;
};

// MandalartGrid.tsx에 하드코딩돼 있던 72칸(빈 칸 제외 58개) 데이터를
// DB로 1회 이관하는 스크립트. 이미 데이터가 있으면(재실행 대비) 전부 지우고 다시 넣는다.
async function main() {
  const prisma = new PrismaClient();
  const seedData = JSON.parse(
    readFileSync('/tmp/mandalart-seed.json', 'utf8'),
  ) as {
    items: SeedItem[];
  };

  await prisma.mandalartItem.deleteMany();
  await prisma.mandalartItem.createMany({
    data: seedData.items.map((i) => ({
      theme: i.theme,
      themeName: i.themeName,
      title: i.title,
      done: i.done,
      position: i.position,
    })),
  });

  const count = await prisma.mandalartItem.count();
  console.log(`seeded ${count} mandalart items`);

  await prisma.$disconnect();
}

void main();
