import {
  buildSoapEnvelope,
  SOAP_NAMESPACES,
  sendSoapRequest
} from "./soap.js";
import {
  DataboxError,
  SessionExpiredError
} from "../errors.js";
import {
  DataboxEntry,
  DataboxListRequest,
  FileArt,
  FinanzonlineCredentials,
  ReadStatus
} from "../models/types.js";

const DATABOX_SERVICE_URL = "https://finanzonline.bmf.gv.at/fon/ws/databox";

interface DataboxListResponse {
  rc?: number | string;
  msg?: string;
  result?: DataboxListEntryRaw | DataboxListEntryRaw[];
}

interface DataboxEntryResponse {
  rc?: number | string;
  msg?: string;
  result?: string;
}

interface DataboxListEntryRaw {
  stnr?: string;
  name?: string;
  anbringen?: string;
  zrvon?: string;
  zrbis?: string;
  datbesch?: string;
  erltyp?: string;
  fileart?: string;
  ts_zust?: string;
  applkey?: string;
  filebez?: string;
  status?: string;
}

export interface DataboxClientOptions {
  timeoutSeconds?: number;
  fetcher?: typeof fetch;
  serviceUrl?: string;
}

export class DataboxClient {
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch | undefined;
  private readonly serviceUrl: string;

  constructor(options: DataboxClientOptions = {}) {
    this.timeoutMs = (options.timeoutSeconds ?? 30) * 1000;
    this.fetcher = options.fetcher;
    this.serviceUrl = options.serviceUrl ?? DATABOX_SERVICE_URL;
  }

  async getDatabox(
    sessionId: string,
    credentials: FinanzonlineCredentials,
    request: DataboxListRequest = {}
  ): Promise<DataboxEntry[]> {
    const body = buildSoapEnvelope(SOAP_NAMESPACES.databox, "getDatabox", {
      tid: credentials.tid,
      benid: credentials.benid,
      id: sessionId,
      erltyp: request.erltyp ?? "",
      ts_zust_von: request.ts_zust_von,
      ts_zust_bis: request.ts_zust_bis
    });

    const response = await sendSoapRequest<DataboxListResponse>({
      url: this.serviceUrl,
      action: "getDatabox",
      body,
      timeoutMs: this.timeoutMs,
      ...(this.fetcher ? { fetcher: this.fetcher } : {})
    });

    const returnCode = normalizeReturnCode(response.rc);
    if (returnCode === -1) {
      throw new SessionExpiredError(
        response.msg ?? "Session expired",
        returnCode
      );
    }

    if (returnCode !== 0) {
      throw new DataboxError(
        response.msg ?? "Failed to list databox",
        returnCode
      );
    }

    const raw = response.result;
    if (!raw) {
      return [];
    }

    const entries = Array.isArray(raw) ? raw : [raw];
    return entries.map(parseEntry);
  }

  async getDataboxEntry(
    sessionId: string,
    credentials: FinanzonlineCredentials,
    applkey: string
  ): Promise<Buffer> {
    const body = buildSoapEnvelope(SOAP_NAMESPACES.databox, "getDataboxEntry", {
      tid: credentials.tid,
      benid: credentials.benid,
      id: sessionId,
      applkey
    });

    const response = await sendSoapRequest<DataboxEntryResponse>({
      url: this.serviceUrl,
      action: "getDataboxEntry",
      body,
      timeoutMs: this.timeoutMs,
      ...(this.fetcher ? { fetcher: this.fetcher } : {})
    });

    const returnCode = normalizeReturnCode(response.rc);
    if (returnCode === -1) {
      throw new SessionExpiredError(
        response.msg ?? "Session expired",
        returnCode
      );
    }

    if (returnCode !== 0) {
      throw new DataboxError(
        response.msg ?? "Failed to download databox entry",
        returnCode
      );
    }

    if (!response.result) {
      throw new DataboxError("Missing document content", returnCode);
    }

    if (!isLikelyBase64(response.result)) {
      throw new DataboxError("Invalid base64 content", returnCode);
    }

    return Buffer.from(response.result, "base64");
  }
}

function parseEntry(raw: DataboxListEntryRaw): DataboxEntry {
  const datbesch = raw.datbesch ? new Date(`${raw.datbesch}T00:00:00Z`) : new Date(0);
  const tsZust = raw.ts_zust ? new Date(raw.ts_zust) : new Date(0);

  return {
    stnr: raw.stnr ?? "",
    name: raw.name ?? "",
    anbringen: raw.anbringen ?? "",
    zrvon: raw.zrvon ?? "",
    zrbis: raw.zrbis ?? "",
    datbesch,
    erltyp: raw.erltyp ?? "",
    fileart: normalizeFileart(raw.fileart),
    ts_zust: tsZust,
    applkey: raw.applkey ?? "",
    filebez: raw.filebez ?? "",
    status: normalizeStatus(raw.status)
  };
}

function normalizeFileart(value?: string): FileArt {
  const normalized = (value ?? "").toUpperCase();
  return normalized === "XML" ? "XML" : "PDF";
}

function normalizeStatus(value?: string): ReadStatus {
  const normalized = (value ?? "").toUpperCase();
  return normalized === "READ" ? "READ" : "UNREAD";
}

function normalizeReturnCode(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value ?? NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
}

function isLikelyBase64(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}
