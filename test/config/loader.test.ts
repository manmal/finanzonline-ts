import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/loader.js";
import { ConfigurationError } from "../../src/errors.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "finanzonline-"));
}

describe("loadConfig", () => {
  it("merges config sources by priority", () => {
    const root = makeTempDir();
    const nested = path.join(root, "child");
    fs.mkdirSync(nested);

    fs.writeFileSync(
      path.join(root, "finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'AAAAAA11'",
        "benid = 'USER01'",
        "pin = 'from-toml'",
        "herstellerid = 'ATU11111111'",
        "output_dir = '/tmp/from-toml'",
        "session_timeout = 11",
        "query_timeout = 22"
      ].join("\n")
    );

    fs.writeFileSync(
      path.join(root, ".env"),
      [
        "FINANZONLINE__PIN=from-dotenv",
        "FINANZONLINE__OUTPUT_DIR=/tmp/from-dotenv"
      ].join("\n")
    );

    const { config, sources } = loadConfig({
      startDir: nested,
      env: {
        FINANZONLINE__PIN: "from-env",
        FINANZONLINE__OUTPUT_DIR: "/tmp/from-env"
      },
      cli: {
        pin: "from-cli",
        output_dir: "/tmp/from-cli"
      }
    });

    expect(config.pin).toBe("from-cli");
    expect(config.output_dir).toBe("/tmp/from-cli");
    expect(config.tid).toBe("AAAAAA11");
    expect(config.session_timeout).toBe(11);
    expect(config.query_timeout).toBe(22);
    expect(sources.tomlPath).toBe(path.join(root, "finanzonline.toml"));
    expect(sources.dotenvPath).toBe(path.join(root, ".env"));
  });

  it("applies defaults for timeouts", () => {
    const root = makeTempDir();
    fs.writeFileSync(
      path.join(root, "finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'AAAAAA11'",
        "benid = 'USER01'",
        "pin = 'secret'",
        "herstellerid = 'ATU11111111'",
        "output_dir = '/tmp/output'"
      ].join("\n")
    );

    const { config } = loadConfig({ startDir: root, env: {} });
    expect(config.session_timeout).toBe(30);
    expect(config.query_timeout).toBe(30);
  });

  it("throws on missing required fields", () => {
    const root = makeTempDir();
    fs.writeFileSync(
      path.join(root, "finanzonline.toml"),
      "[finanzonline]\noutput_dir = '/tmp/output'\n"
    );

    expect(() => loadConfig({ startDir: root, env: {} })).toThrow(
      ConfigurationError
    );
  });
});
