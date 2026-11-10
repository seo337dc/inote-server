-- AlterTable
-- 메모 제목 추가. 추가만 하는 마이그레이션이고 기본값이 ''라 기존 메모·기존 코드에 영향이 없다.
ALTER TABLE "Memo" ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';
