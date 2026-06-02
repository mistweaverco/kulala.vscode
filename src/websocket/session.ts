import type { KulalaCoreBridge, WebSocketSessionHandle } from "../core/bridge";
import type { KulalaRequestResult } from "../core/types";
import type { BodyDisplay } from "../response/body";
import { formatBodyDisplay } from "../response/body";
import {
  buildWsDisplayStream,
  buildWsJqObjectSource,
  buildWsJqSource,
  isEmptyJqDisplay,
  normalizeWsFilterForInput,
} from "./jq";

export type WebSocketSessionState = {
  connected: boolean;
  closed: boolean;
  welcome: string;
  body: BodyDisplay;
  jqFilter?: string;
  error?: string;
};

type SessionCallbacks = {
  onUpdate: (state: WebSocketSessionState) => void;
};

export class WebSocketSession {
  private handle: WebSocketSessionHandle | undefined;
  private messages: string[] = [];
  private welcome = "";
  private filter: string | undefined;
  private connected = false;
  private closed = false;
  private error: string | undefined;
  private readonly initialMessage?: string;

  constructor(
    private readonly bridge: KulalaCoreBridge,
    private readonly plan: KulalaRequestResult,
    private readonly cwd: string | undefined,
    private readonly callbacks: SessionCallbacks,
  ) {
    this.filter = plan.jqFilter;
    this.initialMessage = plan.initialMessage ?? plan.request?.body;
  }

  get isActive(): boolean {
    return Boolean(this.handle) && !this.closed;
  }

  async connect(): Promise<void> {
    if (this.handle) {
      this.close();
    }

    const url = this.plan.url ?? this.plan.request?.url ?? "";
    const headers = this.plan.request?.headers;
    const body = this.plan.request?.body ?? this.plan.initialMessage;

    this.handle = await this.bridge.websocketStart(
      { url, body, headers },
      {
        onEvent: (ev) => {
          if (ev.type === "ready") {
            this.connected = true;
            this.welcome =
              "Connected… waiting for messages.\n" +
              "Use the compose box below to send data.\n" +
              "Press Kulala: Close WebSocket or cancel to disconnect.\n\n";
            this.refresh();
          } else if (ev.type === "message") {
            this.messages.push(ev.data);
            this.refresh();
          } else if (ev.type === "error") {
            this.error = ev.error;
            this.refresh();
          } else if (ev.type === "closed") {
            this.closed = true;
            this.connected = false;
            if (this.welcome) {
              this.welcome += "Connection closed\n";
            }
            this.refresh();
          }
        },
      },
      this.cwd,
    );

    if (!this.handle) {
      this.error = "Failed to start WebSocket session";
      this.refresh();
    }
  }

  send(data: string): boolean {
    if (!this.handle || this.closed) return false;
    const trimmed = data.trim();
    if (!trimmed) return false;
    this.handle.send(trimmed);
    return true;
  }

  close(): void {
    if (this.handle) {
      this.handle.close();
      this.handle.kill();
      this.handle = undefined;
    }
    this.closed = true;
    this.connected = false;
  }

  setFilter(filter: string | undefined): void {
    this.filter = filter && filter.trim() ? filter.trim() : undefined;
    void this.refreshAsync();
  }

  getFilter(): string | undefined {
    return this.filter;
  }

  getRawBody(): string {
    return buildWsJqSource(this.messages);
  }

  private refresh(): void {
    void this.refreshAsync();
  }

  private async refreshAsync(): Promise<void> {
    const prefix = this.welcome;
    const stream = buildWsDisplayStream(this.messages);
    const filter = this.filter;

    if (filter) {
      const { input, hasObjects } = buildWsJqObjectSource(this.messages, this.initialMessage);
      if (hasObjects && input) {
        const normalized = normalizeWsFilterForInput(filter, input);
        const { result, err } = await this.bridge.applyJqFilter(
          input,
          normalized,
          "application/json",
          this.cwd,
        );
        if (result?.filteredBody) {
          const display = formatBodyDisplay(result.filteredBody);
          if (!isEmptyJqDisplay(display.text)) {
            this.callbacks.onUpdate({
              connected: this.connected,
              closed: this.closed,
              welcome: prefix,
              body: display,
              jqFilter: filter,
              error: this.error,
            });
            return;
          }
        } else if (err && this.messages.length > 0) {
          this.error = err;
        }
      }
    }

    const text = prefix + (stream || (this.error ? `WebSocket error: ${this.error}\n` : ""));
    this.callbacks.onUpdate({
      connected: this.connected,
      closed: this.closed,
      welcome: prefix,
      body: { kind: "text", text },
      jqFilter: filter,
      error: this.error,
    });
  }
}
