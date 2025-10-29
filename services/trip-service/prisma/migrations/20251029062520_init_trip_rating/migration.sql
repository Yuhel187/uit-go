-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SEARCHING', 'DRIVER_FOUND', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'SEARCHING',
    "passengerId" INTEGER NOT NULL,
    "driverId" INTEGER,
    "fromLocationLat" DOUBLE PRECISION NOT NULL,
    "fromLocationLng" DOUBLE PRECISION NOT NULL,
    "fromAddress" TEXT,
    "toLocationLat" DOUBLE PRECISION NOT NULL,
    "toLocationLng" DOUBLE PRECISION NOT NULL,
    "toAddress" TEXT,
    "priceEstimate" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "passengerId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_tripId_key" ON "ratings"("tripId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
