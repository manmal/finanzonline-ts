# finanzonline-ts

![CI](https://github.com/manmal/finanzonline-ts/actions/workflows/ci.yml/badge.svg)
![npm](https://img.shields.io/npm/v/finanzonline-ts)
![license](https://img.shields.io/npm/l/finanzonline-ts)

Read-only TypeScript SDK and CLI for the Austrian FinanzOnline DataBox API.

This is a TypeScript port of the Python package
[finanzonline_databox](https://github.com/bitranox/finanzonline_databox) by
Robert Nowotny (bitranox). Huge thanks for the original implementation and docs.

## Features

- Login/logout session handling
- List DataBox documents (Bescheide, Mitteilungen, etc.)
- Download documents as base64-decoded PDF/XML
- CLI with list/download/sync commands
- Layered config: CLI flags → env → .env → TOML
- Strict TypeScript types and error classes

## Installation

```bash
pnpm add finanzonline-ts
```

```bash
bun add finanzonline-ts
```

## Quick Start

```ts
import { DataboxClient, SessionClient, loadConfig } from "finanzonline-ts";

const { config } = loadConfig();
const sessionClient = new SessionClient({ timeoutSeconds: config.session_timeout });
const databoxClient = new DataboxClient({ timeoutSeconds: config.query_timeout });

const session = await sessionClient.login({
  tid: config.tid,
  benid: config.benid,
  pin: config.pin,
  herstellerid: config.herstellerid
});

const entries = await databoxClient.getDatabox(session.sessionId, config, {
  erltyp: "B"
});

const pdf = await databoxClient.getDataboxEntry(
  session.sessionId,
  config,
  entries[0].applkey
);
```

## CLI Reference

```bash
finanzonline --help
```

### List documents

```bash
finanzonline list --erltyp B --days 30
finanzonline list --all
finanzonline list --read
```

### Download a specific document

```bash
finanzonline download <applkey> --output ./downloads
```

### Sync documents

```bash
finanzonline sync --erltyp B --days 7
finanzonline sync --all
```

## Configuration

Config is loaded in priority order:

1. CLI flags
2. Environment variables
3. `.env` in current/parent directories
4. `finanzonline.toml` in current/parent directories

Compatibility notes:
- The original Python package uses a layered config system; this port uses a
  single `finanzonline.toml` plus `.env` discovery.

### Environment variables

```bash
FINANZONLINE__TID=12345678
FINANZONLINE__BENID=WEBUSER
FINANZONLINE__PIN=secret
FINANZONLINE__HERSTELLERID=ATU12345678
FINANZONLINE__OUTPUT_DIR=/tmp/finanzonline
FINANZONLINE__SESSION_TIMEOUT=30
FINANZONLINE__QUERY_TIMEOUT=30
```

### TOML config (`finanzonline.toml`)

```toml
[finanzonline]
tid = "12345678"
benid = "WEBUSER"
pin = "secret"
herstellerid = "ATU12345678"
output_dir = "/tmp/finanzonline"
session_timeout = 30
query_timeout = 30
```

### CLI flags

```bash
finanzonline \
  --tid 12345678 \
  --benid WEBUSER \
  --pin secret \
  --herstellerid ATU12345678 \
  --output-dir /tmp/finanzonline
```

## SDK Usage

```ts
import { DataboxClient, SessionClient } from "finanzonline-ts";

const sessionClient = new SessionClient({ timeoutSeconds: 30 });
const databoxClient = new DataboxClient({ timeoutSeconds: 30 });

const session = await sessionClient.login({
  tid: "12345678",
  benid: "WEBUSER",
  pin: "secret",
  herstellerid: "ATU12345678"
});

const entries = await databoxClient.getDatabox(session.sessionId, {
  tid: "12345678",
  benid: "WEBUSER",
  pin: "secret",
  herstellerid: "ATU12345678"
});
```

## Edge Cases & Warnings

- Invalid credentials return `rc=-4` and throw `InvalidCredentialsError`.
- Expired sessions return `rc=-1` and throw `SessionExpiredError`.
- Maintenance mode responses include `/wartung/` and throw `MaintenanceError`.
- Network timeouts throw `NetworkError`.
- Invalid XML responses throw `InvalidXmlError`.

## License

MIT

## Credits

- Original Python implementation:
  [bitranox/finanzonline_databox](https://github.com/bitranox/finanzonline_databox)
