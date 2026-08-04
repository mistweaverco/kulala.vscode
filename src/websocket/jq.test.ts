import { describe, expect, test } from "vite-plus/test";
import { buildWsDisplayStream, buildWsJqSource } from "./jq";

describe("buildWsDisplayStream", () => {
  test("prefixes incoming and outgoing messages", () => {
    expect(
      buildWsDisplayStream([
        { direction: "in", data: "Request served by 6e82931b755587" },
        { direction: "in", data: '{"name":"world"}' },
        { direction: "out", data: '{"foo": 1}' },
      ]),
    ).toBe(
      ["<-- Request served by 6e82931b755587", '<-- {"name":"world"}', '--> {"foo": 1}'].join("\n"),
    );
  });
});

describe("buildWsJqSource", () => {
  test("includes payloads from both directions", () => {
    expect(
      buildWsJqSource([
        { direction: "out", data: '{"name":"world"}' },
        { direction: "in", data: '{"echo":"world"}' },
      ]),
    ).toBe('[{"name":"world"},{"echo":"world"}]');
  });
});
