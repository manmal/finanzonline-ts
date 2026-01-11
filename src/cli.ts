#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { DataboxClient } from "./client/databox.js";
import { SessionClient } from "./client/session.js";
import { loadConfig } from "./config/loader.js";
import { DataboxEntry } from "./models/types.js";

interface GlobalOptions {
  tid?: string;
  benid?: string;
  pin?: string;
  herstellerid?: string;
  outputDir?: string;
  sessionTimeout?: number;
  queryTimeout?: number;
}

const program = new Command();

program
  .name("finanzonline")
  .description("FinanzOnline DataBox CLI")
  .option("--tid <tid>", "Teilnehmer-ID")
  .option("--benid <benid>", "Benutzer-ID")
  .option("--pin <pin>", "PIN/Password")
  .option("--herstellerid <herstellerid>", "Hersteller-ID (ATU...) ")
  .option("--output-dir <dir>", "Default output directory")
  .option("--session-timeout <seconds>", "Session timeout in seconds", parseNumber)
  .option("--query-timeout <seconds>", "Query timeout in seconds", parseNumber)
  .showHelpAfterError();

program
  .command("list")
  .description("List documents in the DataBox")
  .option("--erltyp <type>", "Filter by document type (B|M|I|P|EU)")
  .option("--days <n>", "Only include documents delivered in last N days", parseNumber)
  .option("--all", "Include both read and unread documents")
  .option("--read", "Only include read documents")
  .action(async (options: Record<string, unknown>) => {
    const config = resolveConfig(program.opts() as GlobalOptions);
    const { sessionId } = await login(config);

    const entries = await listEntries(
      config,
      sessionId,
      options.erltyp as string | undefined,
      options.days as number | undefined
    );

    const filtered = filterEntries(entries, options);

    if (filtered.length === 0) {
      console.log("No entries found.");
      return;
    }

    for (const entry of filtered) {
      console.log(formatEntryLine(entry));
    }
  });

program
  .command("download")
  .description("Download a specific document by applkey")
  .argument("<applkey>", "Document key")
  .option("--output <dir>", "Output directory")
  .action(async (applkey: string, options: Record<string, unknown>) => {
    const config = resolveConfig(program.opts() as GlobalOptions);
    const { sessionId } = await login(config);
    const databoxClient = new DataboxClient({
      timeoutSeconds: config.query_timeout
    });

    const content = await databoxClient.getDataboxEntry(
      sessionId,
      config,
      applkey
    );

    const outputDir = resolveOutputDir(config, options.output as string | undefined);
    ensureDir(outputDir);

    const outputPath = path.join(outputDir, `${sanitizeFileName(applkey)}.pdf`);
    fs.writeFileSync(outputPath, content);
    console.log(`Saved ${outputPath}`);
  });

program
  .command("sync")
  .description("Download all new documents")
  .option("--output <dir>", "Output directory")
  .option("--erltyp <type>", "Filter by document type (default: B)")
  .option("--days <n>", "Only include documents delivered in last N days", parseNumber)
  .option("--all", "Include both read and unread documents")
  .action(async (options: Record<string, unknown>) => {
    const config = resolveConfig(program.opts() as GlobalOptions);
    const { sessionId } = await login(config);

    const erltyp = (options.erltyp as string | undefined) ?? "B";
    const entries = await listEntries(
      config,
      sessionId,
      erltyp,
      options.days as number | undefined
    );

    const filtered = filterEntries(entries, options);
    if (filtered.length === 0) {
      console.log("No entries to sync.");
      return;
    }

    const outputDir = resolveOutputDir(config, options.output as string | undefined);
    ensureDir(outputDir);

    const databoxClient = new DataboxClient({
      timeoutSeconds: config.query_timeout
    });

    for (const entry of filtered) {
      const content = await databoxClient.getDataboxEntry(
        sessionId,
        config,
        entry.applkey
      );
      const outputPath = path.join(outputDir, buildFileName(entry));
      fs.writeFileSync(outputPath, content);
      console.log(`Saved ${outputPath}`);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});

function resolveConfig(globalOptions: GlobalOptions) {
  const { config } = loadConfig({
    cli: {
      tid: globalOptions.tid,
      benid: globalOptions.benid,
      pin: globalOptions.pin,
      herstellerid: globalOptions.herstellerid,
      output_dir: globalOptions.outputDir,
      session_timeout: globalOptions.sessionTimeout,
      query_timeout: globalOptions.queryTimeout
    }
  });
  return config;
}

async function login(config: {
  tid: string;
  benid: string;
  pin: string;
  herstellerid: string;
  session_timeout: number;
}) {
  const sessionClient = new SessionClient({
    timeoutSeconds: config.session_timeout
  });
  return sessionClient.login({
    tid: config.tid,
    benid: config.benid,
    pin: config.pin,
    herstellerid: config.herstellerid
  });
}

async function listEntries(
  config: {
    tid: string;
    benid: string;
    pin: string;
    herstellerid: string;
    query_timeout: number;
  },
  sessionId: string,
  erltyp?: string,
  days?: number
): Promise<DataboxEntry[]> {
  const databoxClient = new DataboxClient({
    timeoutSeconds: config.query_timeout
  });
  const request: { erltyp?: string; ts_zust_von?: Date } = {};
  if (erltyp) {
    request.erltyp = erltyp;
  }
  if (days) {
    request.ts_zust_von = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  return databoxClient.getDatabox(sessionId, config, request);
}

function filterEntries(entries: DataboxEntry[], options: Record<string, unknown>) {
  if (options.all) {
    return entries;
  }
  if (options.read) {
    return entries.filter((entry) => entry.status === "READ");
  }
  return entries.filter((entry) => entry.status === "UNREAD");
}

function formatEntryLine(entry: DataboxEntry): string {
  const date = entry.ts_zust.toISOString();
  return [
    date,
    entry.status,
    entry.erltyp,
    entry.fileart,
    entry.applkey,
    entry.filebez || entry.name
  ].join(" | ");
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return parsed;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputDir(
  config: { output_dir: string },
  overrideDir?: string
): string {
  return overrideDir ?? config.output_dir;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function buildFileName(entry: DataboxEntry): string {
  const base = sanitizeFileName(entry.filebez || entry.name || entry.applkey);
  const suffix = sanitizeFileName(entry.applkey);
  const extension = entry.fileart === "XML" ? "xml" : "pdf";
  return `${base}_${suffix}.${extension}`;
}
