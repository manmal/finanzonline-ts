import { XMLParser } from "fast-xml-parser";
import {
  FinanzonlineError,
  InvalidXmlError,
  MaintenanceError,
  NetworkError,
  SoapFaultError
} from "../errors.js";

const SOAP_ENV_NS = "http://schemas.xmlsoap.org/soap/envelope/";

export interface SoapRequestOptions {
  url: string;
  action: string;
  body: string;
  timeoutMs: number;
  fetcher?: typeof fetch;
}

export const SOAP_NAMESPACES = {
  session: "https://finanzonline.bmf.gv.at/fon/ws/session",
  databox: "https://finanzonline.bmf.gv.at/fon/ws/databox"
};

export function buildSoapEnvelope(
  namespace: string,
  operation: string,
  params: Record<string, string | number | Date | undefined | null>
): string {
  const serializedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      if (value instanceof Date) {
        return `<${key}>${escapeXml(value.toISOString())}</${key}>`;
      }
      return `<${key}>${escapeXml(String(value))}</${key}>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="${SOAP_ENV_NS}" xmlns:ns="${namespace}">` +
    `<soapenv:Body>` +
    `<ns:${operation}>` +
    serializedParams +
    `</ns:${operation}>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`
  );
}

export async function sendSoapRequest<T>(
  options: SoapRequestOptions
): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetcher(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: options.action
      },
      body: options.body,
      signal: controller.signal
    });

    const text = await response.text();

    if (isMaintenanceResponse(text)) {
      throw new MaintenanceError("FinanzOnline is in maintenance mode.");
    }

    if (!response.ok) {
      throw new NetworkError(
        `SOAP request failed with status ${response.status}`
      );
    }

    return parseSoapBody<T>(text);
  } catch (error) {
    if (error instanceof MaintenanceError) {
      throw error;
    }

    if (error instanceof InvalidXmlError) {
      throw error;
    }

    if (error instanceof SoapFaultError) {
      throw error;
    }

    if (error instanceof NetworkError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new NetworkError("SOAP request timed out", error);
    }

    throw new NetworkError("SOAP request failed", error);
  } finally {
    clearTimeout(timeout);
  }
}

export function parseSoapBody<T>(xml: string, expectedKey?: string): T {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true
    });

    const parsed = parser.parse(xml);
    const envelope = parsed?.Envelope;
    const body = envelope?.Body;

    if (!body || typeof body !== "object") {
      throw new InvalidXmlError("SOAP response missing Body", xml.slice(0, 200));
    }

    if (body.Fault) {
      const fault = body.Fault;
      const faultString =
        typeof fault.faultstring === "string"
          ? fault.faultstring
          : "SOAP fault";
      const faultCode =
        typeof fault.faultcode === "string" ? fault.faultcode : undefined;
      throw new SoapFaultError(faultString, faultCode);
    }

    const candidateKeys = Object.keys(body).filter((key) => key !== "Fault");
    const responseKey =
      expectedKey ?? (candidateKeys.length > 0 ? candidateKeys[0] : undefined);

    if (!responseKey || !(responseKey in body)) {
      throw new InvalidXmlError(
        "SOAP response missing expected payload",
        xml.slice(0, 200)
      );
    }

    return body[responseKey] as T;
  } catch (error) {
    if (error instanceof FinanzonlineError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new InvalidXmlError(error.message, xml.slice(0, 200));
    }

    throw new InvalidXmlError("Failed to parse SOAP response", xml.slice(0, 200));
  }
}

export function isMaintenanceResponse(text: string): boolean {
  return /<html/i.test(text) && /\/wartung\//i.test(text);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
