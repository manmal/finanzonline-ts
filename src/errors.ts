export class FinanzonlineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ConfigurationError extends FinanzonlineError {}

export class NetworkError extends FinanzonlineError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

export class SoapFaultError extends FinanzonlineError {
  constructor(message: string, public readonly faultCode?: string) {
    super(message);
  }
}

export class InvalidXmlError extends FinanzonlineError {
  constructor(message: string, public readonly xmlSnippet?: string) {
    super(message);
  }
}

export class MaintenanceError extends FinanzonlineError {}

export class InvalidCredentialsError extends FinanzonlineError {
  constructor(message: string, public readonly returnCode: number) {
    super(message);
  }
}

export class SessionError extends FinanzonlineError {
  constructor(message: string, public readonly returnCode: number) {
    super(message);
  }
}

export class SessionExpiredError extends FinanzonlineError {
  constructor(message: string, public readonly returnCode: number) {
    super(message);
  }
}

export class DataboxError extends FinanzonlineError {
  constructor(message: string, public readonly returnCode: number) {
    super(message);
  }
}
