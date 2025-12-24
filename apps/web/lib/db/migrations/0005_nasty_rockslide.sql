CREATE TABLE IF NOT EXISTS "UserSettings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"openrouterApiKey" text,
	"aiGatewayApiKey" text,
	"freeStoryUsed" boolean DEFAULT false NOT NULL,
	"freeStoryId" varchar(64),
	"misuseWarnings" integer DEFAULT 0 NOT NULL,
	"degradedMode" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "UserSettings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "Message" ADD COLUMN "imageUrl" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
