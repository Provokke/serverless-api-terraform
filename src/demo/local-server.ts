import { createServer, type IncomingMessage, type Server } from "node:http";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createHandler } from "../handler.js";
import { ItemsRepo } from "../items-repo.js";
import { MemoryDynamo } from "./memory-dynamo.js";

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
}

/** Wraps node http so requests look like API Gateway HTTP API (v2) events. */
export function startServer(port: number): Promise<Server> {
  const handler = createHandler(new ItemsRepo(new MemoryDynamo(), "items-local"));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const body = await readBody(req);
    const event = {
      version: "2.0",
      routeKey: "$default",
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers: {},
      queryStringParameters: url.searchParams.size ? Object.fromEntries(url.searchParams) : undefined,
      ...(body === undefined ? {} : { body }),
      isBase64Encoded: false,
      requestContext: { http: { method: req.method ?? "GET", path: url.pathname } },
    } as unknown as APIGatewayProxyEventV2;
    const out = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    res.writeHead(out.statusCode ?? 200, out.headers as Record<string, string>);
    res.end(out.body);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

async function tour(base: string): Promise<void> {
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    console.log(`${method.padEnd(6)} ${path.slice(0, 40).padEnd(40)} -> ${res.status} ${text.slice(0, 90)}`);
    return text ? (JSON.parse(text) as Record<string, any>) : {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  console.log("-- create, bad input, update, stale update, list, delete --");
  const a = await call("POST", "/items", { name: "Widget", description: "blue" });
  await call("POST", "/items", { name: "" });
  await call("PUT", `/items/${a.id}`, { name: "Widget v2", version: 1 });
  await call("PUT", `/items/${a.id}`, { name: "Stale write", version: 1 });
  for (const n of ["b", "c", "d"]) await call("POST", "/items", { name: n });
  const page = await call("GET", "/items?limit=2");
  await call("GET", `/items?limit=2&cursor=${page.nextCursor}`);
  await call("DELETE", `/items/${a.id}`);
  await call("GET", `/items/${a.id}`);
  await call("GET", "/nope");
}

const port = Number(process.env.PORT ?? 8788);
const server = await startServer(port);
console.log(`local API on http://127.0.0.1:${port} (in-memory DynamoDB stand-in, no AWS)`);
if (process.argv.includes("--serve")) {
  console.log("serving until Ctrl+C");
} else {
  await tour(`http://127.0.0.1:${port}`);
  server.close();
}
