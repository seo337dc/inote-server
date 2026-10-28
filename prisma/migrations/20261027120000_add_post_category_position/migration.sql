-- AlterTable
-- 카테고리 위치 이동(PATCH /categories/:id/move): 같은 부모 안에서의 순서. 추가만 하는 마이그레이션이라 기존 코드에 영향이 없다
-- (기본값 0 — 이 컬럼을 모르는 옛 코드가 카테고리를 만들어도 0으로 들어간다).
ALTER TABLE "PostCategory" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- 기존 카테고리는 같은 부모(최상위끼리 포함) 안에서 만든 순서대로 0, 1, 2…로 채운다 — 전부 0이면 순서가 createdAt에만 기대게 된다.
-- PARTITION BY는 "parentId가 NULL인 행들"을 한 묶음(최상위)으로 본다.
UPDATE "PostCategory" AS pc
SET "position" = ranked.rn - 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId", "parentId" ORDER BY "createdAt", "id") AS rn
  FROM "PostCategory"
) AS ranked
WHERE pc."id" = ranked."id";
