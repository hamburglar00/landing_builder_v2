BEGIN READ ONLY;
SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='1s';
SELECT version,name,cardinality(statements) AS statement_count,
md5(replace(array_to_string(statements,E'\n'),E'\r','')) AS stored_text_md5,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?conversions[[:space:](]') AS creates_conversions,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?conversions_config[[:space:](]') AS creates_conversions_config,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'create[[:space:]]+table[[:space:]]+(if[[:space:]]+not[[:space:]]+exists[[:space:]]+)?(public[.])?conversion_logs[[:space:](]') AS creates_conversion_logs,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'public[.]conversions([^_a-z]|$)') AS references_conversions,
EXISTS(SELECT 1 FROM unnest(statements) s WHERE s ~* 'test_event_code') AS mentions_test_event_code
FROM supabase_migrations.schema_migrations ORDER BY version; ROLLBACK;
