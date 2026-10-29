ALTER TABLE "OrderItem" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_notes_length" CHECK (char_length("notes") <= 200);
