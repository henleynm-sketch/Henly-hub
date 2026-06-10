# /imports/

Source-of-truth exports for the real-data seed. **Contents are gitignored** —
this folder is for raw customer data that should never be committed.

## Expected files (drop them here before running `db:seed:bt`)

| File | Source | Notes |
|------|--------|-------|
| `bt-client-contacts.xlsx` | BuilderTrend → Contacts → Export | Customers + their job/lead counts |
| `bt-leads.xlsx` | BuilderTrend → Leads → Export | Lead pipeline with status, salesperson, source, revenue |
| `bt-subs.xlsx` | BuilderTrend → Subs → Export | Subcontractor directory |
| `bt-projects.xlsx` | BuilderTrend → Jobs → Export | (pending) — projects with budget + schedule |
| `hubspot-allcontacts.csv` | HubSpot → Contacts → Export | Full marketing list, filtered at seed time |

## Running the seed

```bash
npm run db:reset:bt
```

Reads everything in `/imports/`, builds the Hub database, and reports the
mapping (matched / new / skipped).
