#!/usr/bin/env bash
# All SQL in this harness runs ONLY against a disposable local PostgreSQL service.
set -euo pipefail
SOURCE="docs/BUILD-LAB-DURABLE-STORAGE-SCHEMA.sql"
OWNER="11111111-1111-4111-8111-111111111111"
case "${PGHOST:-}" in 127.0.0.1|localhost) ;; *) echo "Refusing any nonlocal database target" >&2; exit 2;; esac
if [[ "${PGDATABASE:-}" != "buildlab_migration_test" ]]; then
 echo "Refusing unknown test database" >&2; exit 2
fi
command -v psql >/dev/null
echo "[1/7] Create only synthetic database roles and auth.users"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
SQL
echo "[2/7] Test transactional dry run and complete rollback"
test_sql="$(mktemp)"
test_a=""
test_b=""
trap 'rm -f "$test_sql" "$test_a" "$test_b"' EXIT
awk 'tolower($0) !~ /^[[:space:]]*(begin|commit);[[:space:]]*$/' "$SOURCE" > "$test_sql"
{
 echo "begin;"
 cat "$test_sql"
 echo "rollback;"
} | psql -X -v ON_ERROR_STOP=1 >/dev/null
if [[ "$(psql -X -At -c "select to_regclass('public.eig_build_lab_documents') is null and to_regprocedure('public.eig_build_lab_save_document(uuid,text,integer,jsonb)') is null")" != "t" ]]; then
 echo "Transactional rollback leaked schema objects" >&2; exit 1
fi
echo "[3/7] Apply unchanged proposed SQL to disposable database"
psql -X -v ON_ERROR_STOP=1 -f "$SOURCE" >/dev/null
echo "[4/7] Execute PostgreSQL permission, RLS and atomic-save assertions"
psql -X -v ON_ERROR_STOP=1 -f tests/build-lab-migration-postgres.sql
echo "[5/7] Verify two competing revision-2 saves: exactly one succeeds"
test_a="$(mktemp)"
test_b="$(mktemp)"
query_a="set role service_role; select saved, new_revision from public.eig_build_lab_save_document('$OWNER','scan_history',2,'{\"version\":1,\"entries\":[{\"id\":\"concurrent-a\"}]}'::jsonb);"
query_b="set role service_role; select saved, new_revision from public.eig_build_lab_save_document('$OWNER','scan_history',2,'{\"version\":1,\"entries\":[{\"id\":\"concurrent-b\"}]}'::jsonb);"
psql -X -At -v ON_ERROR_STOP=1 -c "$query_a" > "$test_a" &
pid_a=$!
psql -X -At -v ON_ERROR_STOP=1 -c "$query_b" > "$test_b" &
pid_b=$!
wait "$pid_a"; wait "$pid_b"
success_count="$( (grep -xc 't|3' "$test_a" || true; grep -xc 't|3' "$test_b" || true) | awk '{s+=$1} END {print s+0}')"
conflict_count="$( (grep -xc 'f|3' "$test_a" || true; grep -xc 'f|3' "$test_b" || true) | awk '{s+=$1} END {print s+0}')"
if [[ "$success_count" != "1" || "$conflict_count" != "1" ]]; then
 echo "Concurrency check failed: success=$success_count conflict=$conflict_count" >&2
 cat "$test_a" "$test_b"; exit 1
fi
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $check$
begin
 if (select revision from public.eig_build_lab_documents
  where owner_user_id='11111111-1111-4111-8111-111111111111'
    and document_key='scan_history')<>3 then
  raise exception 'CAS final revision was not 3';
 end if;
 if (select count(*) from public.eig_build_lab_document_revisions
  where owner_user_id='11111111-1111-4111-8111-111111111111'
    and document_key='scan_history')<>3 then
  raise exception 'CAS failed to preserve exactly three history revisions';
 end if;
end
$check$;
SQL
echo "[6/7] Replay migration without dropping or mutating saved data"
psql -X -v ON_ERROR_STOP=1 -f "$SOURCE" >/dev/null
if [[ "$(psql -X -At -c "select revision from public.eig_build_lab_documents where owner_user_id='$OWNER' and document_key='scan_history'")" != "3" ]]; then
 echo "Migration replay unexpectedly modified a saved document" >&2; exit 1
fi
echo "[7/7] Verify anon and authenticated cannot invoke save function"
for role in anon authenticated; do
 if psql -X -v ON_ERROR_STOP=1 -c "set role $role; select * from public.eig_build_lab_save_document('$OWNER','scan_history',3,'{}'::jsonb);" >/dev/null 2>&1; then
  echo "$role unexpectedly invoked privileged Build Lab RPC" >&2; exit 1
 fi
done
echo "PASS: disposable PostgreSQL migration, rollback, roles, RLS, revision history, concurrency, replay and denied RPC"
