-- AlterTable
-- 글 보관함: 보관한 시각. 추가만 하는 마이그레이션이라 기존 글·기존 코드에 영향이 없다 (기본값 없음 = 모든 기존 글은 null = 일반 글).
ALTER TABLE "Post" ADD COLUMN     "archivedAt" TIMESTAMP(3);
