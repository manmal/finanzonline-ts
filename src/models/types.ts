export type FileArt = "PDF" | "XML";
export type ReadStatus = "READ" | "UNREAD";

export interface DataboxEntry {
  stnr: string;
  name: string;
  anbringen: string;
  zrvon: string;
  zrbis: string;
  datbesch: Date;
  erltyp: string;
  fileart: FileArt;
  ts_zust: Date;
  applkey: string;
  filebez: string;
  status: ReadStatus;
}

export interface SessionInfo {
  sessionId: string;
  returnCode: number;
  message: string;
}

export interface FinanzonlineCredentials {
  tid: string;
  benid: string;
  pin: string;
  herstellerid: string;
}

export interface DataboxListRequest {
  erltyp?: string;
  ts_zust_von?: Date;
  ts_zust_bis?: Date;
}

export interface DataboxDownloadRequest {
  applkey: string;
}
