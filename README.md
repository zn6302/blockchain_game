# NOXFLOW

![GIF](./demo_asset/demo_gif.gif)

## Problem and Goal

Cryptocurrency can feel inaccessible to newcomers because even basic discussions
assume familiarity with unfamiliar terms, market behavior, and risk. NOXFLOW gives students and first-time learners an approachable entry point where
they can encounter common concepts such as buying, selling, price trends,
volatility, and leverage through play. The goal is not to teach professional
trading, but to build enough foundational understanding and curiosity for
players to continue learning about the field.

We have made NOXFLOW. A resource management autobattler where you fight four other players by watching where the market is moving, placing purchases and liquidating by summoning cute cats into our hand-crafted hexagonal arena. The game is fully online and supports real time multiplayer up to 4 players, each with diverse classes and strategies. NOXFLOW is meant to make investment seem more apporachable and less distant to the general public. After each match, a simple debrief connects the game played with the real financial concepts behind it.

## Core Features

**The game is live.** NOXFLOW is fully deployed at
[noxcat-arena.fly.dev](https://noxcat-arena.fly.dev/) with real-time online
matchmaking. Press one button and you are in a match against real people within
seconds, on desktop or phone.

- **Real-time multiplayer, already running:** Quick match drops you in with
  whoever is waiting, or share a four-digit code for a private lobby. Rooms are
  server-authoritative, so nobody bends the market from their own browser. AI
  traders — 巨鯨_0x7f, 散戶聯盟, 做市商 MM — fill empty seats, and a dropped player
  has twenty seconds to reconnect before a bot keeps the chair.
![Matchmaking screen](./demo_asset/matchmaking.png)
- **An auto-battler where every unit is an open position:** Summoning a cat is a
  buy. It carries the quantity and the price it paid, mines and fights on its
  own, and loses value as it takes damage. Settling it is a sell. Your portfolio
  is not a menu — it is standing on the battlefield, and you can watch it get shot.
- **A hand-drawn isometric world, not a spreadsheet:** Sixty-one pixel-art hexes
  — $13/s pits, $6/s claims, an exchange that halves your fees, energy peaks that
  cut cooldowns. Every cat, ore cart, and vault is drawn as SVG from shared
  geometry, so the board stays crisp at any zoom.
![World_view](./demo_asset/world.png)
- **A market that pushes back:** One currency, one chart, one truth for everyone
  at the table. Six headlines swing NOX between a 1.85× meme pump and a 0.55×
  unlock dump, and your own orders move the price — the whale who all-ins slips
  their own fill.
- **Money is your health bar:** Cash is life. Hit zero and you are out. The
  richest survivor at the three-minute bell wins, open positions marked to market.
- **Sixty seconds of peace, then knives:** Combat units stay locked for the first
  minute, so every match opens as an economy race before it turns into a fight
  over someone else's mines.
- **Four classes, four real investing lives:** Each is a different answer to
  "where does your money come from, and how much volatility can you survive?"
  Each carries one signature move on a 60-second cooldown, and every move is a
  real strategy rather than a fantasy spell.

![Class_choosing](./demo_asset/char_selection.png)

| Class | Real-world archetype | The hand you are dealt | Signature move |
| --- | --- | --- | --- |
| **小資上班族** · Salaried | Small capital, steady paycheck | $600 to start, 1.5× income, fastest cooldowns | **DCA** — buys a miner every 3 seconds for 24 seconds, completely ignoring the price |
| **定存族** · The Saver | Risk-averse, patient, long-horizon | $1,500 to start, the flattest swings, rewarded for holding | **Staking Lock** — 12 seconds where your cats cannot be hurt and settling is guaranteed not to lose money |
| **梭哈青年** · The Degen | All-or-nothing leverage chaser | $900, cheap units, gains *and* losses doubled | **All-In** — the entire cash balance into a single titan |
| **消息靈通** · The Insider | Trades on information, pays for access | $800, the highest fees on the board, sees news twice as early | **Alpha** — learn the next headline immediately, then hold it back 8 seconds while you position |

- **A debrief that names what you just did:** The result screen ranks the table,
  shows how far you moved from your starting capital, and translates your own
  three minutes into *dollar-cost averaging*, *staking*, *position sizing*, and
  *information edge*. The lesson lands after the fun, attached to a memory of
  winning or blowing up.

![debrief](./demo_asset/debrief.png)

## System Architecture

NOXFLOW is server-authoritative: one match is one Colyseus room, and that room
owns the only real copy of the simulation. Every browser is a thin client that
mirrors room state and sends commands — no decision about money, combat, mining,
or prices is ever made on a player's machine.

The repository is a single npm workspace containing three packages:

```text
noxcat-arena/
├── shared/src/               @noxcat/shared — one copy of the rules, used by both sides
│   ├── constants.js            units, player classes, ultimates, NOX coin factory
│   ├── board.js                the 61-hex board, isometric geometry, SVG tile drawing
│   └── derived.js              balance formulas: fees, mining decay, position value
├── server/src/               @noxcat/server — the authoritative half
│   ├── index.js                HTTP server, Express static files and health check, Colyseus setup
│   ├── rooms/ArenaRoom.js      seats, room code, host, lobby, player messages, 60 Hz loop
│   ├── game.js                 the simulation: units, combat, mining, prices, market events, AI
│   ├── schema/GameState.js     the fields that are actually synchronized to clients
│   └── sync.js                 copies the simulation into schema state once per tick
├── react-app/src/            the browser client
│   ├── game/engine.js          Colyseus connection: mirrors state in, sends commands out
│   ├── game/state.js           the local mirror S, plus the shared formulas bound to it
│   ├── game/mapEngine.js       SVG renderer for the hex map, units, effects, and camera
│   ├── components/             entry, class select, lobby, HUD, map stage, result screens
│   └── hooks/                  useSyncExternalStore bridge from the engine to React
├── Dockerfile                single image holding the server and the built frontend
└── fly.toml                  Fly.io deployment configuration for that image
```

```mermaid
flowchart TB
    subgraph browser["Browser — react-app"]
        C1["React screens, HUD, dock<br/>components/"]
        C2["SVG map renderer<br/>game/mapEngine.js"]
        C3["Local mirror S and COINS<br/>game/state.js"]
        C4["Client engine<br/>game/engine.js"]
    end

    subgraph node["Node.js process — server"]
        S1["Express<br/>built frontend and health check"]
        S2["Colyseus matchmaker<br/>rooms filtered by room code"]
        S3["ArenaRoom<br/>seats, host, 60 Hz timestep"]
        S4["Game simulation<br/>game.js"]
        S5["sync.js"]
        S6["Colyseus schema state<br/>schema/GameState.js"]
    end

    SH["shared/<br/>constants, board, derived"]

    S1 -->|"serves the built frontend"| C1
    C1 --> C4
    C4 -->|"join with a four-digit code"| S2
    C4 -->|"summon, ultimate, settle, pick class, start"| S3
    S2 --> S3
    S3 --> S4
    S4 --> S5
    S5 --> S6
    S6 -->|"state patches, 20 per second"| C4
    S3 -->|"effect, sound, toast, game-over messages"| C4
    C4 --> C3
    C3 --> C1
    C3 --> C2
    SH -.-> S4
    SH -.-> C3
    SH -.-> C2
```

**Joining a match.** Rooms are filtered by room code, so a client only ever
matches into a room created with the same code. Creating a room draws a random
four-digit code and *joins or creates*, so two players who happen to draw the
same number share one room instead of opening two. Joining by code only *joins*,
so a wrong code fails instead of silently opening an empty room. Public
matchmaking is the same mechanism on the reserved code `0001`.

**Inside a room.** Four seats, each starting as a bot and claimed by the next
client to join. The first arrival becomes host, and host passes to a remaining
player if they leave. The match starts when the host presses start or all four
seats hold humans, and the room then locks. Leaving during the lobby frees the
seat; leaving mid-match returns it to a bot and opens the reconnection window.

**The simulation loop.** The room runs a fixed 60 Hz timestep advancing combat,
mining, and the countdown, with prices and market events on their own slower
cadence. After each tick, `sync.js` copies the simulation into the Colyseus
schema, which is broadcast to clients as patches twenty times per second. The
match ends on the clock or the last player standing, and every player receives a
personal summary.

**Two shapes of state on the server.** `game.js` keeps plain JavaScript objects,
because the shared balance formulas are written against plain objects and reused
unchanged in the browser. The schema in `schema/GameState.js` is a separate,
deliberately smaller structure holding only what clients need, and `sync.js` is
the one-way bridge between them — keeping simulation, synchronization, and
networking as three separate concerns. One-off events such as hit effects,
sounds, notifications, and the end-of-match report travel as room messages rather
than state, and the chart's price history is rebuilt locally by each client
instead of being resent every tick.

**The client mirror.** `engine.js` is the only module that knows the game is
networked: it writes incoming state into a single local object shaped like the
server's, and turns player input into room messages. Components read that object
through a `useSyncExternalStore` subscription, and a separate animation-frame
loop drives the SVG map so motion stays smooth between patches.

**One copy of the rules.** The `shared` package holds the board layout, the unit
and class tables, and the balance formulas. The cost shown on a card is produced
by exactly the same code the server uses to charge for it.

**One origin in production.** The Docker image ships the built frontend beside
the server, and one Node process serves both the page and the WebSocket on a
single port — one URL for players, with secure pages upgrading to `wss`
automatically. In development, Vite and the game server run on separate ports and
the client picks the correct endpoint.

## Technologies Used

| Category | Technology / Service | Purpose |
| --- | --- | --- |
| Frontend | React 19, Vite, SVG | User interface, development tooling, and battlefield rendering. |
| Backend | Node.js, Colyseus, Express, WebSocket | Multiplayer rooms, matchmaking, synchronization, and authoritative simulation. |
| Shared Logic | npm workspaces, JavaScript modules | Rules and formulas shared by the frontend and backend. |
| Deployment | Docker, Fly.io, GitHub Actions | Single-image build, hosting, and continuous deployment on every push to `main`. |

## Installation and Running

Node.js 22 or newer is required. This repository uses npm workspaces, so run all
installation commands from the repository root.

```bash
# Install frontend, server, and shared-package dependencies.
npm install

# Terminal A: start the Colyseus server on port 2567.
npm run server

# Terminal B: start the frontend development server.
npm run dev
```

Open the local URL printed by Vite. Both commands must remain running while the
game is being played.

To test with phones or other computers on the same local network:

```bash
# Terminal A
npm run server

# Terminal B
npm run dev:lan
```

All devices must use the frontend URL printed by `npm run dev:lan` and must be
connected to the same network. Only the host computer needs to run the project.

To run the production setup locally, where one process serves both the page and
the multiplayer connection:

```bash
npm run preview:prod
```

Additional checks:

```bash
npm run lint
npm run build
```

## Demo

- Live demo URL: [NOXFLOW](https://noxcat-arena.fly.dev/), multiplayer supported.
- Evaluation video: Not available yet.

## Limitations and Future Work

- Match state is held in memory and is not persisted after the server stops, so
  a match interrupted by a restart cannot be resumed.
- A disconnected player has twenty seconds to reconnect. After that, a
  computer-controlled player keeps the seat for the rest of the match.
- All rooms run on a single hosted machine, so total capacity is bound by that
  machine rather than distributed across regions.
- The game still needs broader mobile-device, latency, and balance testing.
- Future work may include persistent player profiles, additional market events,
  improved onboarding, ranked matchmaking, and horizontal scaling.

## Third-Party Services, Data, and Assets

- [React](https://react.dev/) — MIT License.
- [Vite](https://vite.dev/) — MIT License.
- [Colyseus](https://colyseus.io/) — MIT License.
- [Express](https://expressjs.com/) — MIT License.
- [Fly.io](https://fly.io/) — hosting platform for the deployed demo.
- No API keys, tokens, personal information, or external market data are required.
- All in-game art, sprites, and sound are original work by the team.

## Team Members

| Name | Responsibility |
| --- | --- |
| 楊芷翎 | UI design, game design, and prototyping |
| 梁家祥 | Systems engineering |
| 葉子倪 | Frontend animation and full-stack engineering |
| 沈采葳 | Frontend design and user experience |
| 陳聖文 | Full-stack engineering, deployment, and CI/CD |

## License

NOXFLOW is released under the MIT License. The full text is in
[LICENSE](LICENSE) at the repository root.
