# MedPilot

MedPilot is a chronic-care assistant focused on:
- Structured doctor-order intake
- Medication reminders with full state tracking
- Adherence tracking with accurate statistics
- Home metric interpretation
- HealthManual archiving
- Visit-summary preparation

## Current Status: v0.2.0-rc (Release Candidate)

This version is suitable for **Beta testing** and **early user trials**.

### What's Included
- ✅ TypeScript domain models aligned to the MVP spec
- ✅ Complete reminder/intake state flow (scheduled → triggered → completed/missed/skipped)
- ✅ Accurate adherence statistics based on expected doses
- ✅ Safety-rule evaluation for high blood pressure and fasting glucose
- ✅ HealthManual directory bootstrap and summary writing
- ✅ JSON file persistence
- ✅ HTTP API server for integration
- ✅ CLI entrypoints for quick validation
- ✅ 48 unit tests

## Quick Start

### Installation

```bash
npm install
npm run build
npm run check  # Run tests
```

### CLI Usage

```bash
# Parse a medication order
npm run dev -- parse-order --patient pat_001 --text "氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片"

# Initialize HealthManual
npm run dev -- init-manual

# Record a metric
npm run dev -- record-metric --patient pat_001 --type blood_pressure --values '{"systolic":145,"diastolic":92}'

# Build weekly report
npm run dev -- build-report --patient pat_001
```

### API Server

```bash
# Start the API server
npm run api

# Or in development mode
npm run api:dev
```

The API server runs on `http://localhost:3456` by default.

#### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/patients/:id` | Get patient overview |
| GET | `/api/patients/:id/reminders` | List active reminders |
| GET | `/api/patients/:id/expected-intakes` | Get expected intakes |
| GET | `/api/patients/:id/report` | Build weekly report |
| POST | `/api/orders` | Ingest order |
| POST | `/api/intakes` | Record intake |
| POST | `/api/intakes/skip` | Skip intake |
| POST | `/api/metrics` | Record metric |

#### API Example

```bash
# Ingest an order
curl -X POST http://localhost:3456/api/orders \
  -H "Content-Type: application/json" \
  -d '{"patientId":"pat_001","text":"氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片"}'

# Get patient report
curl http://localhost:3456/api/patients/pat_001/report
```

## Architecture

```
medpilot/
├── src/
│   ├── api.ts           # HTTP API server
│   ├── cli.ts           # CLI entrypoint
│   ├── index.ts         # Public exports
│   ├── core/
│   │   └── id.ts        # ID generation
│   ├── models/
│   │   └── types.ts     # Domain types
│   ├── rules/
│   │   ├── adherence.ts # Adherence calculation
│   │   └── safety.ts    # Safety rules
│   ├── services/
│   │   ├── workflow.ts  # Main workflow
│   │   ├── reminder.ts  # Reminder state flow
│   │   ├── intake.ts    # Intake logging
│   │   ├── report.ts    # Report generation
│   │   ├── parser.ts    # Order parsing
│   │   ├── manual.ts    # HealthManual management
│   │   └── store.ts     # Persistence layer
│   └── utils/
│       └── time.ts      # Time utilities
├── tests/               # Test files
├── docs/                # Documentation
├── data/                # Data storage (JSON)
└── HealthManual/        # Generated health records
```

## Release Readiness

### Ready for Beta
- ✅ Core medication tracking
- ✅ Accurate adherence statistics
- ✅ JSON persistence
- ✅ HTTP API
- ✅ CLI tools

### Not for Production Yet
- ❌ User authentication
- ❌ Multi-patient data isolation
- ❌ OCR / voice ingestion
- ❌ Real-time reminder scheduling
- ❌ Production database (PostgreSQL/MySQL)
- ❌ Web UI / Mobile app

See [docs/second-acceptance-report.md](docs/second-acceptance-report.md) for detailed release assessment.

## Development

```bash
# Run tests
npm run test

# Run tests with source maps
npm run test:src

# Build
npm run build

# Check (build + test)
npm run check
```

## License

MIT
