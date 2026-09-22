/*
  Warnings:

  - You are about to drop the column `accessLevel` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserAccessLevel" AS ENUM ('CLIENT', 'DRIVER', 'WORKER', 'ADMIN', 'OWNER');

-- DropIndex
DROP INDEX "User_accessLevel_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "accessLevel";
