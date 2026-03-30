import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ConflictError, InvalidCursorError, ItemsRepo, NotFoundError } from "./items-repo.js";
import { parseLimit, validateItemInput, validateVersion } from "./validate.js";

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

function json(statusCode: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

const notFound = () => json(404, { error: "not_found" });
const badBody = () => json(400, { error: "bad_request", errors: ["body must be valid JSON"] });

function parseBody(event: APIGatewayProxyEventV2): { ok: true; value: unknown } | { ok: false } {
  if (event.body === undefined || event.body === "") return { ok: false };
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createHandler(repo: ItemsRepo): Handler {
  return async (event) => {
    const method = event.requestContext.http.method.toUpperCase();
    const segments = event.rawPath.split("/").filter(Boolean);
    if (segments[0] !== "items" || segments.length > 2) return notFound();
    const id = segments[1] === undefined ? undefined : decodeURIComponent(segments[1]);

    try {
      if (id === undefined) {
        if (method === "GET") {
          const limit = parseLimit(event.queryStringParameters?.limit);
          if (!limit.ok) return json(400, { error: "bad_request", errors: limit.errors });
          return json(200, await repo.list(limit.value, event.queryStringParameters?.cursor));
        }
        if (method === "POST") {
          const body = parseBody(event);
          if (!body.ok) return badBody();
          const input = validateItemInput(body.value);
          if (!input.ok) return json(400, { error: "bad_request", errors: input.errors });
          return json(201, await repo.put({ id: randomUUID(), ...input.value }));
        }
        return notFound();
      }

      if (method === "GET") {
        const item = await repo.get(id);
        return item ? json(200, item) : notFound();
      }
      if (method === "PUT") {
        const body = parseBody(event);
        if (!body.ok) return badBody();
        const input = validateItemInput(body.value);
        const version = validateVersion(body.value);
        if (!input.ok || !version.ok) {
          const errors = [...(input.ok ? [] : input.errors), ...(version.ok ? [] : version.errors)];
          return json(400, { error: "bad_request", errors });
        }
        return json(200, await repo.put({ id, ...input.value }, version.value));
      }
      if (method === "DELETE") {
        await repo.delete(id);
        return json(204);
      }
      return notFound();
    } catch (e) {
      if (e instanceof ConflictError) return json(409, { error: "conflict" });
      if (e instanceof NotFoundError) return notFound();
      if (e instanceof InvalidCursorError) {
        return json(400, { error: "bad_request", errors: ["cursor is invalid"] });
      }
      console.error(e);
      return json(500, { error: "internal_error" });
    }
  };
}

let defaultHandler: Handler | undefined;

/** Lambda entry point. Builds the DynamoDB repo from TABLE_NAME on first call. */
export const handler: Handler = (event) => {
  defaultHandler ??= createHandler(
    new ItemsRepo(DynamoDBDocumentClient.from(new DynamoDBClient({})), process.env.TABLE_NAME ?? ""),
  );
  return defaultHandler(event);
};
