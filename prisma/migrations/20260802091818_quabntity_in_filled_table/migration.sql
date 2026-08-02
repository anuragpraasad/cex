/*
  Warnings:

  - Added the required column `quantity` to the `Fill` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Fill" ADD COLUMN     "quantity" INTEGER NOT NULL;
