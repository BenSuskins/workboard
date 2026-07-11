# Apply repo-templates to workboard

Applying shared `bensuskins/*` conventions and doc templates from
`../repo-templates` to this repo.

## Decisions

- **License:** MIT (root `LICENSE`, required for GitHub detection)
- **README:** move to `docs/README.md` (root = `LICENSE` only, per convention)
- **CI:** leave existing `ci.yml` as-is (npm workspaces + Docker boot checks —
  the reusable `verify-js.yml` uses Bun and covers less). Add CodeQL
  `security-scan.yml` calling the reusable workflow.

## Tasks

- [ ] `LICENSE` — MIT, `Copyright (c) 2026 Ben Suskins`
- [ ] `.github/CODEOWNERS` — `* @BenSuskins`
- [ ] `docs/README.md` — restructure current README into template section order;
      convert ASCII diagram to Mermaid; keep it accurate to the codebase
- [ ] remove root `README.md`
- [ ] `docs/SECURITY.md` — GitHub private vulnerability reporting, `workboard` repo
- [ ] `docs/ARCHITECTURE.md` — overview, Mermaid system + sequence + ER diagrams,
      components table, key decisions
- [ ] `docs/TROUBLESHOOTING.md` — symptom/cause/fix grouped by area
- [ ] `.github/workflows/security-scan.yml` — reusable CodeQL for
      `javascript-typescript`

## Notes

- Downstream convention: open a PR, don't push to `main`. Working on branch
  `apply-repo-templates`.
