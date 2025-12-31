-- Primero agregar la columna como nullable
ALTER TABLE "rooms" ADD COLUMN "created_by" uuid;--> statement-breakpoint
-- Actualizar filas existentes con un usuario por defecto
UPDATE "rooms" SET "created_by" = (SELECT id FROM users LIMIT 1) WHERE "created_by" IS NULL;--> statement-breakpoint
-- Ahora hacer la columna NOT NULL
ALTER TABLE "rooms" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

