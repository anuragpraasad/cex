/*
  Warnings:

  - Added the required column `filledquantity` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `side` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockid` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "Type" AS ENUM ('LIMIT', 'MARKET');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('FILLED', 'UNFILLED');

-- AlterTable
CREATE SEQUENCE order_id_seq;
ALTER TABLE "Order" ADD COLUMN     "filledquantity" INTEGER NOT NULL,
ADD COLUMN     "price" INTEGER NOT NULL,
ADD COLUMN     "side" "Side" NOT NULL,
ADD COLUMN     "status" "Status" NOT NULL,
ADD COLUMN     "stockid" INTEGER NOT NULL,
ADD COLUMN     "type" "Type" NOT NULL,
ALTER COLUMN "id" SET DEFAULT nextval('order_id_seq');
ALTER SEQUENCE order_id_seq OWNED BY "Order"."id";

-- CreateTable
CREATE TABLE "Stock" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" SERIAL NOT NULL,
    "stockid" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "buyorderid" INTEGER NOT NULL,
    "sellorderid" INTEGER NOT NULL,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_stockid_fkey" FOREIGN KEY ("stockid") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_buyorderid_fkey" FOREIGN KEY ("buyorderid") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_sellorderid_fkey" FOREIGN KEY ("sellorderid") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_stockid_fkey" FOREIGN KEY ("stockid") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
