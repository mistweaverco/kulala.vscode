import type {
  ExtensionMessage,
  WebviewMessage,
  WebviewPayload,
} from "../../../shared/response-view";

type VsCodeApi = {
  postMessage(message: WebviewMessage): void;
  getState(): { tab?: WebviewPayload["tab"] } | undefined;
  setState(state: { tab: WebviewPayload["tab"] }): void;
};

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (api) return api;
  if (typeof acquireVsCodeApi !== "function") return undefined;
  api = acquireVsCodeApi() as VsCodeApi;
  return api;
}

export function readInitialPayload(): WebviewPayload | undefined {
  const data = window.__KULALA__;
  if (!data?.entries) return undefined;
  return data;
}

export function listenForExtensionMessages(onState: (payload: WebviewPayload) => void): () => void {
  const handler = (event: MessageEvent<ExtensionMessage>) => {
    const message = event.data;
    if (message?.type === "state") {
      onState(message.payload);
    }
  };
  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

declare function acquireVsCodeApi(): VsCodeApi;
