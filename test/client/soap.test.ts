import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSoapEnvelope,
  isMaintenanceResponse,
  parseSoapBody,
  sendSoapRequest
} from "../../src/client/soap.js";
import {
  InvalidXmlError,
  NetworkError,
  SoapFaultError
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

describe("soap utils", () => {
  it("builds SOAP envelope", () => {
    const xml = buildSoapEnvelope("urn:test", "login", {
      tid: "ABC",
      benid: "USER",
      pin: "secret",
      herstellerid: "ATU123",
      ts_zust_von: new Date("2024-01-01T00:00:00Z")
    });

    expect(xml).toContain("<ns:login>");
    expect(xml).toContain("<tid>ABC</tid>");
    expect(xml).toContain("2024-01-01T00:00:00.000Z");
  });

  it("detects maintenance mode", () => {
    expect(isMaintenanceResponse(readFixture("maintenance.html"))).toBe(true);
  });

  it("parses SOAP faults", () => {
    expect(() => parseSoapBody(readFixture("soap-fault.xml"))).toThrow(
      SoapFaultError
    );
  });

  it("rejects missing body", () => {
    const xml = "<?xml version=\"1.0\"?><Envelope></Envelope>";
    expect(() => parseSoapBody(xml)).toThrow(InvalidXmlError);
  });

  it("rejects when expected payload is missing", () => {
    expect(() =>
      parseSoapBody(readFixture("session-logout-success.xml"), "loginResponse")
    ).toThrow(InvalidXmlError);
  });

  it("throws on non-ok response", async () => {
    await expect(
      sendSoapRequest({
        url: "https://example.com",
        action: "login",
        body: "<xml />",
        timeoutMs: 1000,
        fetcher: mockFetch("<xml />", false, 500)
      })
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
