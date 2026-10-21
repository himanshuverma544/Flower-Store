# Database and ORM Policy

## 1. Primary Rule: Use Prisma ORM
- Always prioritize and use **Prisma ORM methods** (`prisma.<model>.findMany`, `findUnique`, `create`, `update`, `count`, `aggregate`, `$transaction`) for all application logic, API route endpoints, data fetching, mutations, and standard database queries.

## 2. Exceptions: When Raw SQL is Permitted
Raw SQL is strictly limited to low-level scenarios where an ORM abstraction is technically impossible or not supported:
- **PostgreSQL Internal System Functions**: E.g., `SELECT setval(...)` for synchronizing or advancing auto-increment sequences (`pg_sequences`).
- **Database Catalog & Schema Inspection**: Low-level queries inspecting `information_schema` or `pg_catalog`.
- **Low-Level Transactional Rollback Hooks**: Atomic single-connection multi-step execution using raw connection handles where cross-pool ORM abstraction cannot participate in the transaction.

Never use raw SQL for standard CRUD operations, counts, or table reads where Prisma ORM models exist.
