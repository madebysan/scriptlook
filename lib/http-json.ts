import http from "node:http";
import https from "node:https";

// POST a JSON body and wait for the whole reply, however long it takes.
//
// This exists because Node's built-in `fetch` drops a request when no response
// headers have arrived after five minutes. OpenAI and Gemini send nothing at
// all until a non-streamed reply is finished, and a long document can take
// longer than that to write, so `fetch` turned a slow success into
// "fetch failed". A plain `node:http(s)` request has no such limit.
//
// Server-side only: it is used by the API routes, never by the browser.

// How long to wait on a silent connection before giving up. The timer restarts
// whenever bytes arrive, so a provider that sends keep-alive lines can run
// longer than this in total.
export const REPLY_TIMEOUT_MS = 15 * 60_000;

export class ReplyTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`No reply after ${Math.round(timeoutMs / 60_000)} minutes`);
    this.name = "ReplyTimeoutError";
  }
}

// The part of a `fetch` Response the provider calls use.
export type JsonPostResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number = REPLY_TIMEOUT_MS,
): Promise<JsonPostResponse> {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const target = new URL(url);
    const transport = target.protocol === "http:" ? http : https;

    const request = transport.request(
      target,
      {
        method: "POST",
        // A connection of its own, not one from Node's shared pool. Pooled
        // sockets carry a five-second idle timer that can fire on a new
        // request and look like a reply timeout.
        agent: false,
        // Apply the long timer from the moment the socket exists, so a slow
        // name lookup or connect is not cut off by a shorter default.
        timeout: timeoutMs,
        headers: {
          ...headers,
          // The reply is read as plain text, so ask for it uncompressed.
          "accept-encoding": "identity",
          "content-type": "application/json",
          "content-length": String(payload.byteLength),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        // A connection that drops part-way never reaches "end".
        response.on("close", () => {
          if (!response.complete) reject(new Error("The connection closed before the reply finished"));
        });
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => text,
            json: async () => JSON.parse(text) as unknown,
          });
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new ReplyTimeoutError(timeoutMs));
    });
    request.on("error", reject);
    request.end(payload);
  });
}
