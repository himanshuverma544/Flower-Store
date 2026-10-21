# Project Agent Guidelines

## Database & ORM Guidelines
1. **Always use Prisma ORM methods** (`prisma.<model>.findMany`, `findUnique`, `create`, `update`, `count`, `aggregate`, `$transaction`) for all application logic, API route endpoints, data fetching, mutations, and standard database queries.
2. **Only use raw SQL where strictly required**:
   - PostgreSQL internal engine administrative functions (e.g. `setval()` to synchronize auto-increment sequences).
   - Low-level database system/schema inspection (`information_schema`, `pg_catalog`).
   - Single-connection raw transaction handles where ORM pool participation is technically impossible.
