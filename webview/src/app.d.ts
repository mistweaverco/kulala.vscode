declare global {
  interface Window {
    __KULALA__?: import("../../../shared/response-view").WebviewPayload;
  }
}

export {};
