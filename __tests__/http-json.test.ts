// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { postJson, ReplyTimeoutError } from "@/lib/http-json";

type Handler = (request: http.IncomingMessage, body: string, response: http.ServerResponse) => void;

let server: http.Server | undefined;

async function serve(handler: Handler): Promise<string> {
  server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => handler(request, body, response));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/reply`;
}

afterEach(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe("postJson", () => {
  it("posts a JSON body with the given headers and returns the reply", async () => {
    const url = await serve((request, body, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          method: request.method,
          path: request.url,
          auth: request.headers.authorization,
          contentType: request.headers["content-type"],
          received: JSON.parse(body),
        }),
      );
    });

    const reply = await postJson(url, { authorization: "Bearer test" }, { model: "m", note: "café ☕" });
    expect(reply.ok).toBe(true);
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({
      method: "POST",
      path: "/v1/reply",
      auth: "Bearer test",
      contentType: "application/json",
      received: { model: "m", note: "café ☕" },
    });
  });

  it("reports an error status without throwing, with the body still readable", async () => {
    const url = await serve((_request, _body, response) => {
      response.writeHead(429, { "content-type": "application/json" });
      response.end('{"error":{"message":"slow down"}}');
    });

    const reply = await postJson(url, {}, {});
    expect(reply.ok).toBe(false);
    expect(reply.status).toBe(429);
    expect(await reply.text()).toBe('{"error":{"message":"slow down"}}');
  });

  it("waits for a reply that takes a while to start", async () => {
    const url = await serve((_request, _body, response) => {
      setTimeout(() => {
        response.writeHead(200);
        response.end('{"late":true}');
      }, 300);
    });

    const reply = await postJson(url, {}, {}, 2000);
    expect(await reply.json()).toEqual({ late: true });
  });

  it("gives up with a timeout error when the connection stays silent", async () => {
    const url = await serve(() => {
      // Never answer.
    });

    await expect(postJson(url, {}, {}, 150)).rejects.toBeInstanceOf(ReplyTimeoutError);
  });

  it("rejects when the connection drops before the reply is complete", async () => {
    const url = await serve((_request, _body, response) => {
      response.writeHead(200, { "content-length": "100" });
      response.write("partial");
      setTimeout(() => response.destroy(), 50);
    });

    await expect(postJson(url, {}, {})).rejects.toThrow();
  });
});
