# P1: save a visit in one database transaction

Status: **proposal, waiting for team approval. Not applied anywhere.** Owner of the decision: the team (touches the shared Supabase schema).

## Problem

`POST /api/verify` writes facts (updates, inserts, deletes) and then a visit as separate calls, because supabase-js has no transactions. Since T8 (`76359ed`) every failure is reported and a retry finishes the job without duplicates, but:

- if a save fails part-way and the doctor never retries, some facts are verified and the visit is missing;
- the protection against duplicate facts is in the app (a per-patient queue in one process). Two server instances, or a direct database write, can still create two identical facts.

## Smallest safe change

1. One unique index so the database itself refuses duplicate facts.
2. One Postgres function that does the whole save in a single transaction. `api/verify.ts` calls it with `db().rpc('save_visit', …)`.

No table or column changes. Validation stays in `api/verify.ts` (it runs before the call).

### Step 0: find existing duplicates (read only, run first)

The index cannot be created while duplicates exist.

```sql
select patient_id, type, lower(value) as value, count(*) as copies,
       array_agg(id order by (status = 'doctor_verified') desc, verified_at desc nulls last) as ids
from public.facts
group by patient_id, type, lower(value)
having count(*) > 1;
```

Cleaning rule (to approve): keep the first id in `ids` (prefers doctor-verified, then the newest), delete the others. Also check for patients with more than one doctor-verified blood group:

```sql
select patient_id, array_agg(value) from public.facts
where type = 'blood_group' and status = 'doctor_verified'
group by patient_id having count(*) > 1;
```

Those need a clinician's decision, not an automatic rule.

### Step 1: migration (draft, do not run on production first)

```sql
begin;

create unique index if not exists facts_patient_type_value_uq
  on public.facts (patient_id, type, lower(value));

create or replace function public.save_visit(
  p_doctor uuid, p_patient uuid, p_visit uuid,
  p_facts jsonb,          -- [{ "id": uuid|null, "type": text, "value": text }], already validated by the API
  p_remove uuid[], p_transcript jsonb, p_summary text
) returns void
language plpgsql
security invoker          -- the API calls it as service_role; no extra rights
set search_path = public
as $$
declare f jsonb;
begin
  if p_patient is not null then
    -- updates and inserts: one row per (patient, type, value)
    for f in select * from jsonb_array_elements(coalesce(p_facts, '[]'::jsonb)) loop
      if (f->>'id') is not null and exists (select 1 from facts where id = (f->>'id')::uuid and patient_id = p_patient) then
        update facts set type = f->>'type', value = f->>'value', status = 'doctor_verified', verified_by = p_doctor, verified_at = now()
         where id = (f->>'id')::uuid and patient_id = p_patient;
      else
        insert into facts (patient_id, type, value, status, verified_by, verified_at)
        values (p_patient, f->>'type', f->>'value', 'doctor_verified', p_doctor, now())
        on conflict (patient_id, type, lower(value))
        do update set value = excluded.value, status = 'doctor_verified', verified_by = p_doctor, verified_at = now();
      end if;
    end loop;
    delete from facts where patient_id = p_patient and id = any(coalesce(p_remove, '{}'));
  end if;

  insert into visits (id, patient_id, doctor_id, started_at, ended_at, transcript, summary)
  values (p_visit, p_patient, p_doctor, now(), now(), coalesce(p_transcript, '[]'::jsonb), left(coalesce(p_summary, ''), 4000))
  on conflict (id) do nothing;   -- a retry of the same visit changes nothing
end;
$$;

revoke all on function public.save_visit(uuid, uuid, uuid, jsonb, uuid[], jsonb, text) from public, anon, authenticated;
grant execute on function public.save_visit(uuid, uuid, uuid, jsonb, uuid[], jsonb, text) to service_role;

commit;
```

Any error inside the function rolls back every write of that save.

Open points for review: the blood-group clash check (409) stays in the API before the call; `on conflict (id) do nothing` on visits does not check the doctor (the API already refuses a visit id owned by another doctor).

### Rollback

```sql
drop function if exists public.save_visit(uuid, uuid, uuid, jsonb, uuid[], jsonb, text);
drop index if exists public.facts_patient_type_value_uq;
```

The app keeps working after a rollback only if `api/verify.ts` still has the current multi-call path. So ship the code change behind a check: call `save_visit`, and if the function is missing (`PGRST202`), log it and use the current path.

## Files affected

| File | Change |
|---|---|
| `supabase/schema.sql` | Add the index and function (so new setups get them) |
| `api/verify.ts` | `saveVisit()` calls `db().rpc('save_visit', …)`; keeps validation and the blood-group check; falls back on `PGRST202` |
| `api/verify.test.ts` | Tests for the rpc path, a failed rpc (nothing written), and the fallback |
| `test/mocks/supabase.ts` | A small `rpc()` stub in the fake client |
| `.agent/*`, `README.md` | Record the change and the run order |

## Order of work

1. Run step 0 on a copy of the database (or a Supabase branch) and agree on the duplicates to remove.
2. Apply step 1 on the copy, run the app against it, save visits, force a failure, check nothing partial remains.
3. Only then apply on production, in a quiet moment, after a backup.

## Acceptance criteria

- A save that fails at any point leaves no partial facts and no visit (tested by making the function raise after the fact writes).
- Sending the same save twice, or two at once, leaves one visit and no duplicate facts, including across two server instances.
- The database refuses a duplicate `(patient_id, type, lower(value))` insert.
- All existing tests pass; the API still validates before any write and still returns generic 500s.
- Rollback SQL tested on the copy; the app keeps working after rollback (fallback path).
