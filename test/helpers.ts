/* eslint-disable @typescript-eslint/no-explicit-any */
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createHandler } from "../src/handler.js";
import { ItemsRepo } from "../src/items-repo.js";
import { MemoryDynamo } from "../src/demo/memory-dynamo.js";

export function setup() {
  const repo = new ItemsRepo(new MemoryDynamo(), "items-test");
  const handler = createHandler(repo);
  async function call(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<{ status: number; json: any }> {
    const id = path.split("/")[2];
    const event = {
      version: "2.0",
      routeKey: "$default",
      rawPath: path,
      rawQueryString: "",
      headers: {},
      queryStringParameters: query,
      pathParameters: id ? { id } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      isBase64Encoded: false,
      requestContext: { http: { method, path } },
    } as unknown as APIGatewayProxyEventV2;
    const res = (await handler(event)) as APIGatewayProxyStructuredResultV2;
    return { status: res.statusCode ?? 0, json: res.body ? JSON.parse(res.body) : undefined };
  }
  return { repo, call };
}
