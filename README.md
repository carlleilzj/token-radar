# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/carlleilzj/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/carlleilzj/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every protocol that records no token yet by what its launch would be worth, and shows how to farm each one. It reads a sealed DefiLlama snapshot, prices each protocol from the snapshot's own figures — TVL times its category's median market-cap-to-TVL multiple among tokens that already trade, adjusted for seven-day growth, age and chain breadth — and writes a static dashboard that renders with no network: a sortable, filterable board, a detail view per protocol with the model's arithmetic and a six-step farm plan, and a separate view of the protocols whose token already trades.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22.18 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`, and runs deterministically: two runs on the same snapshot write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=3qpq8nfv&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
