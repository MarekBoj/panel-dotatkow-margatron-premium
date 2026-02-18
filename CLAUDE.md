# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tampermonkey/Greasemonkey userscript** for the browser game `world-retro.margatron.ovh`. The entire codebase lives in a single file: `script.user.js` (~7400 lines). There is no build step, no package manager, and no test framework — the script runs directly in the browser via a userscript manager.

## Validation

The only configured command is syntax checking:

```bash
node -c script.user.js
```

This is the single allowed Bash command (see `.claude/settings.local.json`). Use it to verify JS syntax before committing changes.

## Architecture

The script is structured as a large IIFE with distinct sections separated by `// ======================== NAME ========================` comments. Each section is either a standalone module (plain object or class) or a configuration block.

### Core Infrastructure (top of file)

- **AuthTokenFetch** — Injects a `fetch` hook into page context via `document.createElement('script')` to capture the Bearer token from game API calls. Token is stored in `unsafeWindow.__AUTH_TOKEN__` and read into `authToken`.
- **GraphQLManager** — Wrapper for GraphQL queries to `engine-retro.margatron.ovh/graphql` using the captured auth token.
- **CONFIG** — Global constants: icon URLs, rank color codes, the full monster list with ranks, and REST API endpoints.
- **Utils** — Shared helpers: `simulateKeyPress`, `formatTime`, `calculatePercentage`, `parseItemData`, `moveItemToRandomPosition`, `playAudio`.
- **IntervalManager** — Named `setInterval` registry to avoid duplicates; all addon polling uses `intervalManager.set(name, cb, delay)`.
- **BattleMonitor** — Polls DOM every 100ms watching `.battle-window`. Emits events (`battleStart`, `mobsDetected`, `battleWon`, `battleLost`) to subscribers. Used by `KillCounter` and `Minutnik`.

### Addon Modules

Each addon follows the same contract:
```js
const AddonName = {
    toggle(enabled) { /* GM_setValue + start/stop */ },
    // ... implementation
};
```

Addons registered in the `ADDONS` array (line ~6105) with `id`, `icon`, `title`, `desc`, `onToggle`, and optional `settings` array. Settings keys map directly to `GM_getValue`/`GM_setValue` storage keys.

Key addons:
- **AutoHeal** — Listens for keypress, uses consumable item via simulated clicks.
- **AutoBattle / AutoFight** — DOM mutation observers on battle/fight windows.
- **LootFilter** — Watches loot windows and auto-accepts/rejects based on item rarity and price.
- **KillCounter** — Subscribes to BattleMonitor, persists kill stats to `GM_setValue`.
- **Minutnik** — Timer tracking Elite spawn cooldowns, uses BattleMonitor events.
- **HeroDetector** — Polls GraphQL for NPC data, shows browser notifications for Heros/Titans.
- **NpcsOnMap / ItemsOnMap / PlayersOnMap** — Draggable floating panels populated via GraphQL queries on an interval.
- **CharacterSwitcher** — Fetches character list from REST API (`CONFIG.API.CHARACTERS`), switches via `CONFIG.API.JOIN`.
- **Highlights** — MutationObserver on inventory, applies CSS borders by item rarity.
- **LegendLootPanel** — Subscribes to GraphQL for recent legendary drops by all players.
- **AuctionHelper** — MutationObserver on auction dialog, auto-fills form fields.

### UI Layer

- **PanelUI** — The main addon panel (460px fixed div, `#addon-panel`). Renders the `ADDONS` list as toggle rows with settings. Position saved to `localStorage` under `'panelPos'`.
- **WelcomePanel** — One-time splash shown 1s after load.
- **MessageCanvas** — Floating canvas text overlay on `#game-map-window` for in-game notifications.
- **GlobalStyles** — `<style>` tag injected into `document.head` for panel scrollbar and animation CSS.

### Persistence

- `GM_getValue` / `GM_setValue` — All addon enabled/disabled states and settings.
- `localStorage` — Panel and sub-panel drag positions (keys like `'panelPos'`, `'npcsOnMapPos'`, `'killCounterStats'`-type keys for stats are via `GM_setValue`).

### Initialization (bottom of file, line ~7390)

On `window load`:
1. `HotKeys.init()`, `Minutnik.init()`, `KillCounter.init()`, `AutoSeller.init()`
2. `BattleMonitor.startMonitoring()` if kill counter or minutnik is enabled
3. MutationObserver waits for `#panel .small-buttons` then injects the toggle button
4. `ADDONS.forEach(addon => addon.onToggle(GM_getValue(addon.id, addon.default)))` — restores all saved states
5. `WelcomePanel.show()` after 1s delay

## Key Patterns

- All interval-based polling goes through `intervalManager` — always use `intervalManager.set('uniqueName', cb, delay)` to avoid duplicate intervals.
- Addon state is always persisted: call `GM_setValue(addonId, enabled)` at the start of `toggle()`.
- New addons must be added to both the module section and the `ADDONS` array.
- The script targets Vue-rendered DOM — use `MutationObserver` for dynamic content, not one-time `querySelector`.
