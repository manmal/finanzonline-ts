# Task: Port finanzonline_databox to TypeScript

## Overview

Port the Python library `finanzonline_databox` (https://github.com/bitranox/finanzonline_databox) to TypeScript.

This is a **read-only** client for the Austrian FinanzOnline DataBox API. It allows downloading tax documents (Bescheide) from the Austrian tax authority's online portal.

## Original Repository

- **Source**: https://github.com/bitranox/finanzonline_databox
- **License**: MIT
- **Author**: Robert Nowotny (bitranox)

**IMPORTANT**: Give proper attribution in README.md - this is a port with thanks to the original author!

## Target Repository

- **GitHub**: manmal/finanzonline-ts
- **Local path**: ~/Dev/ai/finanzonline-ts

## Requirements

### Project Setup
- TypeScript with strict mode
- Bun and pnpm ready (package.json scripts for both)
- oxlint with good rules (max 300 lines per file)
- GitHub Actions CI with Linux runner
- MIT License

### Architecture
- SDK (library) + CLI in one package
- Export SDK for programmatic use
- CLI with great --help for all commands

### Core Functionality

Port these SOAP endpoints:

1. **Session Service** (`https://finanzonline.bmf.gv.at/fonws/ws/sessionService.wsdl`)
   - `login(tid, benid, pin, herstellerid)` → session_id
   - `logout(tid, benid, session_id)`

2. **DataBox Service** (`https://finanzonline.bmf.gv.at/fon/ws/databoxService.wsdl`)
   - `getDatabox(tid, benid, session_id, erltyp?, ts_zust_von?, ts_zust_bis?)` → list of entries
   - `getDataboxEntry(tid, benid, session_id, applkey)` → document content (base64 PDF)

### CLI Commands

```bash
# List documents
finanzonline list [--erltyp B|M|I|P|EU] [--days N] [--all] [--read]

# Download a specific document
finanzonline download <applkey> [--output <dir>]

# Sync all new documents
finanzonline sync [--output <dir>] [--erltyp B] [--days N] [--all]
```

### Configuration

**MUST support these config methods (in priority order):**
1. CLI flags (highest priority)
2. Environment variables
3. .env file in current/parent directories
4. Config file (TOML)

**Backwards compatible with Python package** where sensible. Document any breaking changes.

**Required config:**
```
finanzonline.tid         - Teilnehmer-ID (8-12 alphanumeric)
finanzonline.benid       - Benutzer-ID (5-12 chars)
finanzonline.pin         - Password (5-128 chars)
finanzonline.herstellerid - Austrian UID (ATUxxxxxxxx)
finanzonline.output_dir  - Default output directory
finanzonline.session_timeout - Timeout in seconds (default 30)
finanzonline.query_timeout - Query timeout (default 30)
```

**Environment variable format:**
```bash
FINANZONLINE__TID=123456789
FINANZONLINE__BENID=WEBUSER
FINANZONLINE__PIN=secret
FINANZONLINE__HERSTELLERID=ATU12345678
```

### Data Models

```typescript
interface DataboxEntry {
  stnr: string;           // Steuernummer
  name: string;           // Document name
  anbringen: string;      // Type code (E1, U1, etc.)
  zrvon: string;          // Period from (year)
  zrbis: string;          // Period to (year)
  datbesch: Date;         // Document date
  erltyp: string;         // B=Bescheid, M=Mitteilung, etc.
  fileart: 'PDF' | 'XML'; // File type
  ts_zust: Date;          // Delivery timestamp
  applkey: string;        // Unique key for download
  filebez: string;        // File description
  status: 'READ' | 'UNREAD';
}
```

### Testing

- **90%+ test coverage**
- Mock SOAP responses (no real API calls in tests)
- Test error handling (auth failures, timeouts, maintenance mode)
- Test config loading from all sources

### Error Handling

Handle these cases:
- Invalid credentials (rc=-4)
- Session expired (rc=-1)
- Maintenance mode (HTML response with "/wartung/")
- Network errors
- Invalid XML responses

### README.md Structure

1. Title + badges (CI, npm, license)
2. One-line description
3. Attribution to original Python package
4. Features
5. Installation (npm, bun)
6. Quick Start
7. CLI Reference (all commands with examples)
8. Configuration (all methods, env vars, config file)
9. SDK Usage (programmatic examples)
10. Edge Cases & Warnings
11. License (MIT)
12. Credits

### Files to Create

```
finanzonline-ts/
├── src/
│   ├── index.ts              # SDK exports
│   ├── cli.ts                # CLI entry point
│   ├── client/
│   │   ├── session.ts        # Session SOAP client
│   │   ├── databox.ts        # DataBox SOAP client
│   │   └── soap.ts           # SOAP utilities
│   ├── config/
│   │   ├── loader.ts         # Config loading
│   │   └── schema.ts         # Config types/validation
│   ├── models/
│   │   └── types.ts          # Domain types
│   └── errors.ts             # Error classes
├── test/
│   ├── client/
│   │   ├── session.test.ts
│   │   └── databox.test.ts
│   ├── config/
│   │   └── loader.test.ts
│   └── fixtures/
│       └── responses/        # Mock SOAP responses
├── package.json
├── tsconfig.json
├── oxlint.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── README.md
├── LICENSE
└── .gitignore
```

## After Implementation

1. Create GitHub repo manmal/finanzonline-ts
2. Push code
3. Verify CI passes
4. Enable issues and PRs (owner-only write to main)
5. Create v0.1.0 release tag

## Reference Code

The Python source files are at:
- Session client: https://raw.githubusercontent.com/bitranox/finanzonline_databox/master/src/finanzonline_databox/adapters/finanzonline/session_client.py
- DataBox client: https://raw.githubusercontent.com/bitranox/finanzonline_databox/master/src/finanzonline_databox/adapters/finanzonline/databox_client.py
- Models: https://raw.githubusercontent.com/bitranox/finanzonline_databox/master/src/finanzonline_databox/domain/models.py

## WSDL Endpoints

- Session: https://finanzonline.bmf.gv.at/fonws/ws/sessionService.wsdl
- DataBox: https://finanzonline.bmf.gv.at/fon/ws/databoxService.wsdl
