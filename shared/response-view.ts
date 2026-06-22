export type TabId = "body" | "headers" | "timings" | "tests" | "console" | "verbose";

export type TestAssertView = { pass: boolean; message: string };

export type TestGroupView = {
  name: string;
  pass: boolean;
  asserts: TestAssertView[];
};

export type VerboseBodyView = {
  body: string;
  bodyKind: "text" | "json";
  bodyHtml?: string;
};

export type VerboseView = {
  requestHeadersRows: Array<{ name: string; value: string }>;
  requestBody: VerboseBodyView;
  responseHeadersRows: Array<{ name: string; value: string }>;
  responseBody: VerboseBodyView;
};

export type ResponseViewState = {
  id: string;
  at: number;
  title: string;
  blockName?: string;
  status: number | string;
  statusBadgeClass: string;
  url?: string;
  method?: string;
  durationMs?: number;
  durationLabel?: string;
  error?: string;
  body: string;
  bodyKind: "text" | "json" | "image" | "binary";
  bodyHtml?: string;
  bodyImageSrc?: string;
  binaryNote?: string;
  headers: string;
  headersRows: Array<{ name: string; value: string }>;
  stats: string;
  timingRows: Array<{ phase: string; ms: number }>;
  console: string;
  consoleLines: Array<{ level: string; message: string; levelClass: string }>;
  testGroups: TestGroupView[];
  jqFilter?: string;
  rawBody?: string;
  contentType?: string;
  isWebSocket?: boolean;
  wsConnected?: boolean;
  wsClosed?: boolean;
  verbose: VerboseView;
};

export type WebviewPayload = {
  theme: "light" | "dark";
  entries: ResponseViewState[];
  index: number;
  tab: TabId;
};

export type WebviewMessage =
  | { type: "select"; index: number }
  | { type: "clearHistory" }
  | { type: "applyJq"; filter: string; entryId: string }
  | { type: "wsSend"; message: string; entryId: string }
  | { type: "wsClose"; entryId: string };

export type ExtensionMessage = { type: "state"; payload: WebviewPayload };
