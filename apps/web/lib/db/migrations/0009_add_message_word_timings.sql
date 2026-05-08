DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Message' AND column_name = 'wordTimings') THEN
        ALTER TABLE "Message" ADD COLUMN "wordTimings" json;
    END IF;
END $$;
