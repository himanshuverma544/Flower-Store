-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "estimatedDelivery" TEXT NOT NULL DEFAULT 'Tomorrow',
    "slot" TEXT NOT NULL DEFAULT 'Morning (9 AM - 1 PM)',
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientApt" TEXT NOT NULL DEFAULT '',
    "recipientCity" TEXT NOT NULL DEFAULT '',
    "recipientState" TEXT NOT NULL DEFAULT '',
    "recipientZip" TEXT NOT NULL DEFAULT '',
    "recipientNotes" TEXT NOT NULL DEFAULT '',
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL DEFAULT '',
    "keepSecret" BOOLEAN NOT NULL DEFAULT false,
    "cardMessage" TEXT NOT NULL DEFAULT '',
    "deliveryDate" TEXT NOT NULL DEFAULT '',
    "deliverySlot" TEXT NOT NULL DEFAULT '',
    "itemsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "originalPrice" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "flowerType" TEXT NOT NULL,
    "stemCount" INTEGER NOT NULL,
    "rating" REAL NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "isBestseller" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT NOT NULL,
    "symbolism" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occasionJson" TEXT NOT NULL DEFAULT '[]',
    "galleryJson" TEXT NOT NULL DEFAULT '[]',
    "careTipsJson" TEXT NOT NULL DEFAULT '[]',
    "sizesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discountPercent" INTEGER,
    "flatDiscount" REAL,
    "freeShipping" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
