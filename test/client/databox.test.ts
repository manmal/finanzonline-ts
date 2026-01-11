import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DataboxClient } from "../../src/client/databox.js";
import { DataboxError, SessionExpiredError } from "../../src/errors.js";

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

describe("DataboxClient", () => {
  const credentials = {
    tid: "ABCDEF12",
    benid: "WEBUSER",
    pin: "secret",
    herstellerid: "ATU12345678"
  };

  it("parses list entries", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-list-success.xml"))
    });

    const entries = await client.getDatabox("SESSIONID", credentials, {});
    expect(entries).toHaveLength(2);
    expect(entries[0].applkey).toBe("AAA111");
    expect(entries[1].fileart).toBe("XML");
  });

  it("returns empty list when no result provided", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-list-empty.xml"))
    });

    const entries = await client.getDatabox("SESSIONID", credentials, {});
    expect(entries).toHaveLength(0);
  });

  it("parses single entry with fallback defaults", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-list-single.xml"))
    });

    const entries = await client.getDatabox("SESSIONID", credentials, {});
    expect(entries).toHaveLength(1);
    expect(entries[0].fileart).toBe("PDF");
    expect(entries[0].status).toBe("UNREAD");
  });

  it("throws on session expired", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-list-session-expired.xml"))
    });

    await expect(
      client.getDatabox("SESSIONID", credentials, {})
    ).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("throws on list failure codes", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-list-fail.xml"))
    });

    await expect(
      client.getDatabox("SESSIONID", credentials, {})
    ).rejects.toBeInstanceOf(DataboxError);
  });

  it("downloads entry content", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-entry-success.xml"))
    });

    const buffer = await client.getDataboxEntry(
      "SESSIONID",
      credentials,
      "AAA111"
    );
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("throws on invalid base64", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-entry-invalid.xml"))
    });

    await expect(
      client.getDataboxEntry("SESSIONID", credentials, "AAA111")
    ).rejects.toBeInstanceOf(DataboxError);
  });

  it("throws when content is missing", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-entry-missing.xml"))
    });

    await expect(
      client.getDataboxEntry("SESSIONID", credentials, "AAA111")
    ).rejects.toBeInstanceOf(DataboxError);
  });

  it("throws on non-zero return code", async () => {
    const client = new DataboxClient({
      fetcher: mockFetch(readFixture("databox-entry-fail.xml"))
    });

    await expect(
      client.getDataboxEntry("SESSIONID", credentials, "AAA111")
    ).rejects.toBeInstanceOf(DataboxError);
  });
});
