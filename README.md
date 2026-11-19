# agenthire-ai

**AgentHire** is a spec-driven, multi-agent AI recruitment platform. Recruiters publish jobs from a
React Native app. Candidates apply from any browser with a PDF resume, and a LangGraph workflow of seven
agents parses, embeds, matches and shortlists each applicant, then **pauses for a human decision** before
interview generation and email.

> AI recommendations never make final hiring decisions. Every candidate is reviewed by a recruiter.

| | |
|---|---|
| Mobile / web | React Native + Expo SDK 58 (JavaScript), Expo Router, NativeWind, Zustand, TanStack Query |
| API | Node.js 20+, Express 5, MongoDB / Mongoose, Zod, JWT |
| AI | LangGraph + LangChain, Groq → OpenRouter, BAAI/bge-small-en-v1.5, Qdrant, Resend |
| Business rules | JSON files under [`specs/`](./specs), validated at startup |

## Repository layout

```
client/   Expo app (iOS, Android, and the public web export for candidates)
server/   Express API, agents, LangGraph workflows, RAG
specs/    Hiring rules, workflow order, prompts, thresholds, email templates
docs/     Architecture, API reference, implementation checklist
```

## Status

Phases 1–6 are complete: foundation and authentication, job management, public applications with PDF
uploads, the parser, embedding and matching agents with RAG, LangGraph orchestration with spec-driven
shortlisting, and human approval with workflow monitoring, retry and checkpoint resume. See
[`docs/IMPLEMENTATION_CHECKLIST.md`](./docs/IMPLEMENTATION_CHECKLIST.md).

## Getting started

Prerequisites: Node.js 22.12+ and Docker Desktop. Android Studio and Xcode are **not** required, because
native builds use Expo EAS.

```bash
# 1. Infrastructure (MongoDB + Qdrant)
docker compose up -d

# 2. API
cd server
cp .env.example .env          # then set JWT_SECRET (see the comment in the file)
npm install
npm run check:specs           # validate /specs
npm run ingest:knowledge      # embed specs/knowledge/** into Qdrant (first run downloads the model)
npm run agents:dry-run        # parser → embedding → matching on the demo resume (prints results)
npm run dev                   # http://localhost:4000

# 3. App
cd ../client
cp .env.example .env          # EXPO_PUBLIC_API_URL; use your LAN IP on a phone
npm install
npm run web                   # browser
npm start                     # then open in a development build
```

### Tests and checks

```bash
cd server && npm test                         # Jest + Supertest (in-memory MongoDB, fake LLM/embedder)
cd server && RUN_REAL_SERVICES=1 npm test -- realServices   # real bge model + Qdrant (Docker Compose)
cd client && npm test                         # jest-expo + React Native Testing Library
cd client && npm run export:web               # web build check
cd client && npm run export:android           # Android JS bundle check
cd client && npm run doctor                   # expo-doctor
```

### Mobile builds (EAS)

```bash
cd client
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
```

## Security

- Secrets live only in `server/.env`, which is gitignored. Nothing secret goes in `EXPO_PUBLIC_*` variables.
- Passwords are hashed with bcrypt. JWTs are verified, and the user is reloaded on every request.
- Inputs are Zod-validated and sanitised against NoSQL injection. The API uses helmet and rate limiting.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Spec reconstruction notes](./docs/SPEC_RECONSTRUCTION.md)
- [API reference](./docs/API.md)
- [Implementation checklist](./docs/IMPLEMENTATION_CHECKLIST.md)
- [Original specification](./AGENTHIRE_SPEC.md)
