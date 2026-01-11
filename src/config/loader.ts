import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import toml from "toml";
import { ConfigurationError } from "../errors.js";
import {
  FinanzonlineConfig,
  FinanzonlineConfigInput,
  finanzonlineSchema
} from "./schema.js";

export interface ConfigLoadOptions {
  cli?: FinanzonlineConfigInput;
  startDir?: string;
  configFile?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ConfigLoadResult {
  config: FinanzonlineConfig;
  sources: {
    tomlPath?: string;
    dotenvPath?: string;
  };
}

const ENV_PREFIX = "FINANZONLINE__";

export function loadConfig(options: ConfigLoadOptions = {}): ConfigLoadResult {
  const startDir = options.startDir ?? process.cwd();
  const env = options.env ?? process.env;

  const tomlResult = loadTomlConfig(options.configFile, startDir);
  const dotenvResult = loadDotEnv(startDir);
  const envConfig = loadEnvConfig(env);
  const cliConfig = options.cli ?? {};

  const merged = mergeConfigs(
    tomlResult.config,
    dotenvResult.config,
    envConfig,
    cliConfig
  );

  const parsed = validateConfig(merged);

  const sources: ConfigLoadResult["sources"] = {};
  if (tomlResult.path) {
    sources.tomlPath = tomlResult.path;
  }
  if (dotenvResult.path) {
    sources.dotenvPath = dotenvResult.path;
  }

  return {
    config: parsed,
    sources
  };
}

function validateConfig(config: FinanzonlineConfigInput): FinanzonlineConfig {
  try {
    return finanzonlineSchema.parse(config);
  } catch (error) {
    throw new ConfigurationError(
      `Invalid configuration: ${formatZodError(error)}`
    );
  }
}

function loadTomlConfig(configFile: string | undefined, startDir: string): {
  config: FinanzonlineConfigInput;
  path?: string;
} {
  const resolvedPath = configFile ?? findFileUpwards(startDir, "finanzonline.toml");
  if (!resolvedPath) {
    return { config: {} };
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const parsed = toml.parse(raw) as Record<string, unknown>;
  const section = (parsed.finanzonline ?? {}) as Record<string, unknown>;
  const config = pickConfig(section);

  return { config, path: resolvedPath };
}

function loadDotEnv(startDir: string): { config: FinanzonlineConfigInput; path?: string } {
  const dotenvPath = findFileUpwards(startDir, ".env");
  if (!dotenvPath) {
    return { config: {} };
  }

  const raw = fs.readFileSync(dotenvPath, "utf8");
  const parsed = dotenv.parse(raw) as Record<string, string>;
  return { config: mapEnvToConfig(parsed), path: dotenvPath };
}

function loadEnvConfig(env: NodeJS.ProcessEnv): FinanzonlineConfigInput {
  return mapEnvToConfig(env as Record<string, string | undefined>);
}

function mapEnvToConfig(env: Record<string, string | undefined>): FinanzonlineConfigInput {
  const getValue = (key: string): string | undefined => env[`${ENV_PREFIX}${key}`];

  return pickConfig({
    tid: getValue("TID"),
    benid: getValue("BENID"),
    pin: getValue("PIN"),
    herstellerid: getValue("HERSTELLERID"),
    output_dir: getValue("OUTPUT_DIR"),
    session_timeout: parseOptionalNumber(getValue("SESSION_TIMEOUT")),
    query_timeout: parseOptionalNumber(getValue("QUERY_TIMEOUT"))
  });
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickConfig(source: Record<string, unknown>): FinanzonlineConfigInput {
  const candidate = {
    tid: typeof source.tid === "string" ? source.tid : undefined,
    benid: typeof source.benid === "string" ? source.benid : undefined,
    pin: typeof source.pin === "string" ? source.pin : undefined,
    herstellerid:
      typeof source.herstellerid === "string" ? source.herstellerid : undefined,
    output_dir:
      typeof source.output_dir === "string" ? source.output_dir : undefined,
    session_timeout:
      typeof source.session_timeout === "number" ? source.session_timeout : undefined,
    query_timeout:
      typeof source.query_timeout === "number" ? source.query_timeout : undefined
  };

  return candidate;
}

function mergeConfigs(...configs: FinanzonlineConfigInput[]): FinanzonlineConfigInput {
  const merged: FinanzonlineConfigInput = {};
  for (const config of configs) {
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined && value !== null) {
        merged[key as keyof FinanzonlineConfigInput] = value as never;
      }
    }
  }
  return merged;
}

function findFileUpwards(startDir: string, filename: string): string | undefined {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function formatZodError(error: unknown): string {
  if (error && typeof error === "object" && "errors" in error) {
    return JSON.stringify((error as { errors: unknown }).errors);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown validation error";
}
