DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Chat' AND column_name = 'storyId') THEN
        ALTER TABLE "Chat" ADD COLUMN "storyId" varchar(64);
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Chat' AND column_name = 'soloMode') THEN
        ALTER TABLE "Chat" ADD COLUMN "soloMode" boolean DEFAULT true;
    END IF;
END $$;