import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type Handler = (request: Request) => Promise<Response>;

/** Real HTTP transport on loopback. Synthetic HTTPS origins preserve the
 * application's URL checks; DNS, production services and redirects are blocked. */
export class LocalHttp {
  private readonly originalFetch = globalThis.fetch;
  private readonly servers: Server[] = [];
  private readonly destinations = new Map<string, string>();
  private activeHandlers = 0;
  private readonly idleWaiters: (() => void)[] = [];
  requests = 0;

  install() {
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const destination = this.destinations.get(url.origin);
      assert.ok(destination, `Blocked non-fixture network origin: ${url.origin}`);
      const headers = new Headers(request.headers);
      headers.set("x-local-flow-url", request.url);
      const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
      this.requests++;
      return this.originalFetch(destination + url.pathname + url.search, {
        method: request.method, headers, body,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]), redirect: "manual",
      });
    };
  }

  async serve(origin: string, handler: Handler) {
    const server = createServer(async (incoming, outgoing) => {
      this.activeHandlers++;
      try {
        const parts: Buffer[] = [];
        let bytes = 0;
        for await (const part of incoming) {
          bytes += part.length;
          assert.ok(bytes < 128_000, "Fixture request too large");
          parts.push(part);
        }
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
        const publicUrl = headers.get("x-local-flow-url");
        headers.delete("x-local-flow-url");
        assert.ok(publicUrl && new URL(publicUrl).origin === origin, "Invalid fixture routing");
        const method = incoming.method || "GET";
        const request = new Request(publicUrl, { method, headers,
          body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(parts) });
        const response = await handler(request);
        outgoing.statusCode = response.status;
        response.headers.forEach((value, name) => { if (name !== "set-cookie") outgoing.setHeader(name, value); });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) outgoing.setHeader("set-cookie", cookies);
        outgoing.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        // Never log request bodies, query strings, credentials or cookies.
        console.error("[local-http]", error instanceof Error ? error.message : "Fixture server failure");
        outgoing.statusCode = 500;
        outgoing.end('{"error":"fixture_server_failure"}');
      } finally {
        if (--this.activeHandlers === 0) for (const resolve of this.idleWaiters.splice(0)) resolve();
      }
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    this.servers.push(server);
    this.destinations.set(origin, `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  }

  async idle() {
    if (this.activeHandlers) await new Promise<void>(resolve => this.idleWaiters.push(resolve));
  }

  async close() {
    await this.idle();
    globalThis.fetch = this.originalFetch;
    await Promise.all(this.servers.map(server => new Promise<void>(resolve => {
      server.closeAllConnections();
      server.close(() => resolve());
    })));
  }
}
