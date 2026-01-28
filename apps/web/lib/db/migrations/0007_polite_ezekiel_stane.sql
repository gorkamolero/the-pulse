DO $$ BEGIN
 ALTER TABLE "Room" ADD COLUMN "storyId" varchar(64);
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;