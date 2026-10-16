-- AlterTable
-- 글이 카테고리를 이름 문자열(category)이 아니라 id로도 가리키게 한다. 추가만 하는 마이그레이션 — 기존 컬럼·데이터는 건드리지 않는다.
-- 기존 글의 categoryId는 이 마이그레이션에서 채우지 않는다(null). 백필 스크립트(scripts/backfill-post-category-id.ts)가
-- "작성자 트리에서 이름이 정확히 하나만 맞는 글"만 따로 채운다.
ALTER TABLE "Post" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");

-- AddForeignKey
-- 카테고리가 지워지면 글은 지워지지 않고 categoryId만 null이 된다(= 지정 안 된 글).
ALTER TABLE "Post" ADD CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
