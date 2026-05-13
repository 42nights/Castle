# /data — seed JSON

Data files for seeding Convex. All files currently empty - ready for new data.

- `fdes.json` — engineers on the bench
- `customers.json` — companies we're contracted with
- `engagements.json` — the operational entity. One row per FDE-customer engagement, with phase, progress, health, weekly hours, notes
- `templates.json` — agent templates extracted from prior work, reusable across customers
- `deployments.json` — concrete agent shipped to a customer, optionally based on a template
- `pattern_extractions.json` — log of "Customer X needed Y → built as Template T → reused at N more customers"
- `founder_hours.json` — monthly founder hours vs new ARR brought on. Ratio is the investor signal

Schemas live in `/lib/types.ts`.
