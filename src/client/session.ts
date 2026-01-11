import {
  buildSoapEnvelope,
  SOAP_NAMESPACES,
  sendSoapRequest
} from "./soap.js";
import {
  InvalidCredentialsError,
  SessionError
} from "../errors.js";
import { FinanzonlineCredentials, SessionInfo } from "../models/types.js";

const SESSION_SERVICE_URL = "https://finanzonline.bmf.gv.at:443/fonws/ws/session";

interface LoginResponse {
  id?: string;
  rc?: number | string;
  msg?: string;
}

interface LogoutResponse {
  rc?: number | string;
  msg?: string;
}

export interface SessionClientOptions {
  timeoutSeconds?: number;
  fetcher?: typeof fetch;
  serviceUrl?: string;
}

export class SessionClient {
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch | undefined;
  private readonly serviceUrl: string;

  constructor(options: SessionClientOptions = {}) {
    this.timeoutMs = (options.timeoutSeconds ?? 30) * 1000;
    this.fetcher = options.fetcher;
    this.serviceUrl = options.serviceUrl ?? SESSION_SERVICE_URL;
  }

  async login(credentials: FinanzonlineCredentials): Promise<SessionInfo> {
    const body = buildSoapEnvelope(SOAP_NAMESPACES.session, "login", {
      tid: credentials.tid,
      benid: credentials.benid,
      pin: credentials.pin,
      herstellerid: credentials.herstellerid
    });

    const response = await sendSoapRequest<LoginResponse>({
      url: this.serviceUrl,
      action: "login",
      body,
      timeoutMs: this.timeoutMs,
      ...(this.fetcher ? { fetcher: this.fetcher } : {})
    });

    const returnCode = normalizeReturnCode(response.rc);
    const message = response.msg ?? "";
    const sessionId = response.id ?? "";

    if (returnCode === -4) {
      throw new InvalidCredentialsError(
        message || "Invalid credentials",
        returnCode
      );
    }

    if (returnCode !== 0) {
      throw new SessionError(
        message || "Session login failed",
        returnCode
      );
    }

    if (!sessionId) {
      throw new SessionError("Session ID missing in response", returnCode);
    }

    return { sessionId, returnCode, message };
  }

  async logout(sessionId: string, credentials: FinanzonlineCredentials): Promise<boolean> {
    const body = buildSoapEnvelope(SOAP_NAMESPACES.session, "logout", {
      tid: credentials.tid,
      benid: credentials.benid,
      id: sessionId
    });

    const response = await sendSoapRequest<LogoutResponse>({
      url: this.serviceUrl,
      action: "logout",
      body,
      timeoutMs: this.timeoutMs,
      ...(this.fetcher ? { fetcher: this.fetcher } : {})
    });

    const returnCode = normalizeReturnCode(response.rc);
    return returnCode === 0;
  }
}

function normalizeReturnCode(value: number | string | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value ?? NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
}
