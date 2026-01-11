import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SessionClient } from "../../src/client/session.js";
import {
  InvalidCredentialsError,
  InvalidXmlError,
  MaintenanceError,
  NetworkError,
  SessionError
} from "../../src/errors.js";

const fixtures = path.join(
  process.cwd(),
  "test",
  "fixtures",
  "responses"
);

function readFixture(name: string) {
  return fs.readFileSync(path.join(fixtures, name), "utf8");
}

function mockFetch(body: string, ok = true, status = 200): typeof fetch {
  return (async () => ({
    ok,
    status,
    text: async () => body
  })) as typeof fetch;
}

describe("SessionClient", () => {
  const credentials = {
    tid: "ABCDEF12",
    benid: "WEBUSER",
    pin: "secret",
    herstellerid: "ATU12345678"
  };

  it("logs in successfully", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-login-success.xml"))
    });

    const session = await client.login(credentials);
    expect(session.sessionId).toBe("ABCDEF123456");
    expect(session.returnCode).toBe(0);
  });

  it("throws on invalid credentials", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-login-invalid.xml"))
    });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
  });

  it("throws on other login failures", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-login-fail.xml"))
    });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(
      SessionError
    );
  });

  it("throws when session id is missing", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-login-missing-id.xml"))
    });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(
      SessionError
    );
  });

  it("handles maintenance mode", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("maintenance.html"))
    });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(
      MaintenanceError
    );
  });

  it("handles invalid XML", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("invalid.xml"))
    });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(
      InvalidXmlError
    );
  });

  it("handles network errors", async () => {
    const failingFetch = (async () => {
      throw new Error("Network down");
    }) as typeof fetch;

    const client = new SessionClient({ fetcher: failingFetch });

    await expect(client.login(credentials)).rejects.toBeInstanceOf(NetworkError);
  });

  it("logs out successfully", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-logout-success.xml"))
    });

    const result = await client.logout("ABCDEF123456", credentials);
    expect(result).toBe(true);
  });

  it("returns false on logout failure", async () => {
    const client = new SessionClient({
      fetcher: mockFetch(readFixture("session-logout-fail.xml"))
    });

    const result = await client.logout("ABCDEF123456", credentials);
    expect(result).toBe(false);
  });
});
