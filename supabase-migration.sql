-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Adds JSONB columns for all the array/object data that currently isn't persisted

ALTER TABLE loan_applications
  ADD COLUMN IF NOT EXISTS owners JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS debts JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS banks JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS affiliates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resumes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pfs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parsed_documents JSONB DEFAULT '[]'::jsonb;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loan_applications' 
ORDER BY ordinal_position;
