import type { OpenAPIUITreeNode, OpenAPIUiPayload } from "../src/core/types";

export type OpenAPITryValues = Record<string, Record<string, string>>;

export type OpenAPIViewState = {
  theme: "light" | "dark";
  title?: string;
  version?: string;
  cacheKey?: string;
  tree: OpenAPIUITreeNode[];
  tryValues: OpenAPITryValues;
};

export type OpenAPIWebviewMessage =
  | { type: "setTryValue"; operationKey: string; paramName: string; value: string }
  | { type: "runOperation"; operationKey: string }
  | { type: "copyAsHttp"; operationKey: string }
  | { type: "pickFile"; operationKey: string; paramName: string }
  | { type: "close" };

export type OpenAPIExtensionMessage = { type: "openapiState"; payload: OpenAPIViewState };

export type { OpenAPIUITreeNode, OpenAPIUiPayload };
