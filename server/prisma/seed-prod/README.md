# Production seed

Seeds only the records a fresh production database needs to take bookings:
users, the Iron Peak tenant (+ its TenantSettings), tenant memberships,
dumpsters, and add-ons. No test bookings.

Run (after `prisma migrate deploy`):

    npm run prisma:seed:prod

## Safe to re-run

Every write is create-only (`upsert` with an empty `update`). Running it again
never overwrites something an admin changed in the dashboard. To change a value
after the first run, change it in the app or the database, not here.

## Open items

Anything we still need from the business is marked `// TODO(prod):` in the
`*.data.ts` files and listed in that file's `*_TODOS` array. The seed prints
the list and refuses to run while any are open. Once a value is filled in,
delete its entry from the array.

To run anyway (for staging, or to load the skeleton and fix values in the
dashboard later):

    ALLOW_PROD_SEED_TODOS=1 npm run prisma:seed:prod
