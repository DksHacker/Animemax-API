# Animemax API

A fast anime streaming REST API built with [Hono](https://hono.dev) and Bun. Scrapes data from anikoto.cz and serves structured JSON endpoints for anime streaming platforms.

## Features

- 🏠 Homepage — spotlight, latest episodes, top 10, genres
- 📺 Episodes — full episode list with sub/dub info
- 🖥️ Servers — available streaming servers per episode
- ▶️ Stream — direct embed URL via megaplay.buzz
- 🔍 Search & Suggestions
- 📄 Anime Detail pages
- 📅 Schedule
- 🎭 Characters & People
- 📑 Swagger UI docs at `/ui`

## Tech Stack

- [Bun](https://bun.sh) runtime
- [Hono](https://hono.dev) web framework
- [Cheerio](https://cheerio.js.org) HTML parsing
- [Axios](https://axios-http.com) HTTP client
- [Upstash Redis](https://upstash.com) optional caching

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Install

```bash
git clone https://github.com/DksHacker/Animemax-API
cd Animemax-API
bun install
```

### Environment Variables

Create a `.env` file:

```env
ORIGIN=http://localhost:5000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_LIMIT=20

# Optional Redis caching
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Run

```bash
# Development (with hot reload)
bun run dev

# Production
bun run start
```

Server starts at `http://localhost:3030`  
Swagger docs at `http://localhost:3030/ui`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/home` | Homepage data |
| GET | `/api/v1/episodes/:id` | Episode list for an anime |
| GET | `/api/v1/servers?id=` | Servers for an episode |
| GET | `/api/v1/stream?id=&server=&type=` | Stream URL |
| GET | `/api/v1/search?q=` | Search anime |
| GET | `/api/v1/anime/:id` | Anime detail |
| GET | `/api/v1/suggestion?q=` | Search suggestions |
| GET | `/api/v1/schadule` | Weekly schedule |
| GET | `/api/v1/genres` | All genres |
| GET | `/api/v1/filter` | Filter anime |

### Stream Flow

```
GET /api/v1/episodes/{slug}
  → returns episodes[] with id and dataIds per episode

GET /api/v1/servers?id={slug}::ep={dataIds}
  → returns { sub: [...servers], dub: [...servers] }

GET /api/v1/stream?id={slug}::ep={dataIds}&server=Vidstream-2&type=sub
  → returns { link: { file: "https://megaplay.buzz/...", type: "embed" } }
```

## License

MIT © [DksHacker](https://github.com/DksHacker)
