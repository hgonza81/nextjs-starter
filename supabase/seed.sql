-- Applied by 'pnpm db:reset' after all migrations.
-- No data in epic 001 (FND-FR-05).
--
-- LOCAL DEVELOPMENT ONLY. This sets the password of the app_backend role to a
-- well-known, non-secret value that matches DATABASE_URL in .env.example.
-- seed.sql only runs against the local stack; it must never be applied to a
-- cloud project. The cloud password is a real secret, set manually and stored
-- only in the hosting provider's environment variables (ADR 0003, ADR 0004).
alter role app_backend with password 'app_backend_local_password';
