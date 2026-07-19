-- ---------------------------------------------------------------------------
-- Launch hardening (A5): object-level RLS on Storage
--
-- Uploads/downloads normally go through short-lived signed URLs minted with the
-- service role, but direct object access must still be scoped. Object paths
-- encode the owner in their first folder:
--   import-files:  <user_id>/<uuid>/<filename>
--   reports:       <dataset_id>/<report_id>.csv
--
-- These policies enforce that a user can only touch objects under a prefix they
-- own/administer. Guarded so it is a no-op where the Storage schema is absent
-- (e.g. the PGlite test harness).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;

  -- import-files: a user may read and write only their own uploads.
  execute $p$
    create policy import_files_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'import-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $p$;
  execute $p$
    create policy import_files_write on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'import-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $p$;
  execute $p$
    create policy import_files_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'import-files'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
  $p$;

  -- reports: readable by anyone who can access the dataset in the first folder.
  -- Generation is done by the worker (service role), so no client write policy.
  execute $p$
    create policy reports_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'reports'
        and private.user_can_access_dataset(
          (select auth.uid()),
          ((storage.foldername(name))[1])::uuid
        )
      )
  $p$;
end
$$;
