/*
  Warnings:

  - You are about to drop the column `memo` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Expense` table. All the data in the column will be lost.
  - The `category` column on the `Expense` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `fixedExpense` on the `UserSetting` table. All the data in the column will be lost.
  - The `savings` column on the `UserSetting` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Stock` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `salary` on table `UserSetting` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salaryDate` on table `UserSetting` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Category" AS ENUM ('FOOD', 'CAFE', 'TRANSPORT', 'SHOPPING', 'MEDICAL', 'CULTURE', 'SUBSCRIPTION', 'ETC');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('KR', 'US');

-- CreateEnum
CREATE TYPE "InputMode" AS ENUM ('QUANTITY', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('WEEKLY', 'MONTHLY');

-- DropForeignKey
ALTER TABLE "Stock" DROP CONSTRAINT "Stock_userId_fkey";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "memo",
DROP COLUMN "type",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isWaste" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "category",
ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'ETC';

-- AlterTable
ALTER TABLE "UserSetting" DROP COLUMN "fixedExpense",
ADD COLUMN     "assetUpdateDate" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "dailyLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fixedExpenses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "monthlySavingGoal" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "salary" SET NOT NULL,
ALTER COLUMN "salary" SET DEFAULT 0,
DROP COLUMN "savings",
ADD COLUMN     "savings" JSONB NOT NULL DEFAULT '[]',
ALTER COLUMN "salaryDate" SET NOT NULL,
ALTER COLUMN "salaryDate" SET DEFAULT 25;

-- DropTable
DROP TABLE "Stock";

-- CreateTable
CREATE TABLE "StockHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "inputMode" "InputMode" NOT NULL,
    "quantity" DOUBLE PRECISION,
    "averagePrice" DOUBLE PRECISION,
    "investedAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReviewType" NOT NULL,
    "year" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_type_year_period_key" ON "Review"("userId", "type", "year", "period");

-- AddForeignKey
ALTER TABLE "StockHolding" ADD CONSTRAINT "StockHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
