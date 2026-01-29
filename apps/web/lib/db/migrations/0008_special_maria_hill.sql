ALTER TABLE "Chat" ADD COLUMN "storyId" varchar(64);--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "soloMode" boolean DEFAULT true;