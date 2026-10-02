-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "lastEditedAt" TIMESTAMP(3);

-- 기존 발행 글은 "수정 안 함" 상태로 시작한다 (지금까지의 수정 이력은 알 수 없어서 발행 시각으로 채움).
-- draft(publishedAt이 null)는 그대로 null.
UPDATE "Post" SET "lastEditedAt" = "publishedAt" WHERE "publishedAt" IS NOT NULL;
