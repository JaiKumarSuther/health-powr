-- 028_fix_duplicate_orgs.sql
-- Remove duplicate organizations per owner, keeping the earliest-created row.
-- When created_at is identical (rare), keep the lexicographically smallest id.
DELETE FROM public.organizations a
USING public.organizations b
WHERE a.owner_id = b.owner_id
  AND a.owner_id IS NOT NULL
  AND (
    a.created_at > b.created_at
    OR (a.created_at = b.created_at AND a.id::text > b.id::text)
  );

-- Prevent future duplicates at the DB level.
--
-- Seeded organizations intentionally have no owner. Ensure owner_id allows NULL
-- so multiple seeded orgs can coexist without an owner account.
ALTER TABLE public.organizations
  ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_owner_id_unique;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_owner_id_unique UNIQUE (owner_id);
