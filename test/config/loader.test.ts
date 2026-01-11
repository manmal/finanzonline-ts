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

  it("finds .finanzonline.toml in home directory", () => {
    const fakeHome = makeTempDir();
    const workDir = makeTempDir();

    fs.writeFileSync(
      path.join(fakeHome, ".finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'HOMEDIR1'",
        "benid = 'HOMEUSER'",
        "pin = 'homesecret'",
        "herstellerid = 'ATU99999999'",
        "output_dir = '/tmp/home-output'"
      ].join("\n")
    );

    const { config, sources } = loadConfig({
      startDir: workDir,
      env: { HOME: fakeHome }
    });

    expect(config.tid).toBe("HOMEDIR1");
    expect(config.benid).toBe("HOMEUSER");
    expect(config.pin).toBe("homesecret");
    expect(config.herstellerid).toBe("ATU99999999");
    expect(config.output_dir).toBe("/tmp/home-output");
    expect(sources.tomlPath).toBe(path.join(fakeHome, ".finanzonline.toml"));
  });

  it("prefers local config over home directory config", () => {
    const fakeHome = makeTempDir();
    const workDir = makeTempDir();

    fs.writeFileSync(
      path.join(fakeHome, ".finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'HOMEDIR1'",
        "benid = 'HOMEUSER'",
        "pin = 'homesecret'",
        "herstellerid = 'ATU99999999'",
        "output_dir = '/tmp/home-output'"
      ].join("\n")
    );

    fs.writeFileSync(
      path.join(workDir, "finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'LOCALDIR'",
        "benid = 'LOCALUSER'",
        "pin = 'localsecret'",
        "herstellerid = 'ATU11111111'",
        "output_dir = '/tmp/local-output'"
      ].join("\n")
    );

    const { config, sources } = loadConfig({
      startDir: workDir,
      env: { HOME: fakeHome }
    });

    expect(config.tid).toBe("LOCALDIR");
    expect(config.benid).toBe("LOCALUSER");
    expect(sources.tomlPath).toBe(path.join(workDir, "finanzonline.toml"));
  });

  it("finds finanzonline.toml without dot prefix in home directory", () => {
    const fakeHome = makeTempDir();
    const workDir = makeTempDir();

    fs.writeFileSync(
      path.join(fakeHome, "finanzonline.toml"),
      [
        "[finanzonline]",
        "tid = 'HOMENODOT'",
        "benid = 'NODOTUSER'",
        "pin = 'nodotsecret'",
        "herstellerid = 'ATU88888888'",
        "output_dir = '/tmp/nodot-output'"
      ].join("\n")
    );

    const { config, sources } = loadConfig({
      startDir: workDir,
      env: { HOME: fakeHome }
    });

    expect(config.tid).toBe("HOMENODOT");
    expect(sources.tomlPath).toBe(path.join(fakeHome, "finanzonline.toml"));
  });
});
