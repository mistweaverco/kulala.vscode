declare global {
  interface Window {
    __KULALA__?: import("../../../shared/response-view").WebviewPayload;
    __KULALA_OPENAPI__?: import("../../../shared/openapi-view").OpenAPIViewState;
    MonacoEnvironment?: {
      getWorker(moduleId: string, label: string): Worker;
    };
  }
}

declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

export {};
