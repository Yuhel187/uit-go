-- CreateTable
CREATE TABLE "TripRejectedDriver" (
    "id" SERIAL NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripRejectedDriver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripRejectedDriver_tripId_driverId_key" ON "TripRejectedDriver"("tripId", "driverId");

-- AddForeignKey
ALTER TABLE "TripRejectedDriver" ADD CONSTRAINT "TripRejectedDriver_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
