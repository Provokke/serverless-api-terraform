/* eslint-disable @typescript-eslint/no-explicit-any */
import type { DocClient } from "../items-repo.js";

type Row = Record<string, unknown>;

class ConditionalCheckFailedException extends Error {
  override name = "ConditionalCheckFailedException";
}

interface CommandLike {
  constructor: { name: string };
  input: Record<string, any>;
}

/** In-memory stand-in for DynamoDBDocumentClient.send(). Only handles what ItemsRepo sends. */
export class MemoryDynamo implements DocClient {
  private rows = new Map<string, Row>();

  send = (async (command: CommandLike) => {
    const input = command.input;
    switch (command.constructor.name) {
      case "PutCommand": {
        const item = input.Item as Row;
        const key = `${item.pk as string}|${item.sk as string}`;
        const existing = this.rows.get(key);
        const cond = input.ConditionExpression as string | undefined;
        if (cond === "attribute_not_exists(sk)" && existing) throw new ConditionalCheckFailedException();
        if (cond === "#v = :expected") {
          if (!existing || existing.version !== input.ExpressionAttributeValues[":expected"]) {
            throw new ConditionalCheckFailedException();
          }
        }
        this.rows.set(key, { ...item });
        return {};
      }
      case "GetCommand": {
        const row = this.rows.get(`${input.Key.pk}|${input.Key.sk}`);
        return row ? { Item: { ...row } } : {};
      }
      case "DeleteCommand": {
        const key = `${input.Key.pk}|${input.Key.sk}`;
        if (input.ConditionExpression === "attribute_exists(sk)" && !this.rows.has(key)) {
          throw new ConditionalCheckFailedException();
        }
        this.rows.delete(key);
        return {};
      }
      case "QueryCommand": {
        const pk = input.ExpressionAttributeValues[":pk"] as string;
        const after = input.ExclusiveStartKey?.sk as string | undefined;
        const sorted = [...this.rows.values()]
          .filter((r) => r.pk === pk && (after === undefined || (r.sk as string) > after))
          .sort((a, b) => ((a.sk as string) < (b.sk as string) ? -1 : 1));
        const limit = (input.Limit as number | undefined) ?? sorted.length;
        const page = sorted.slice(0, limit);
        const out: Row = { Items: page.map((r) => ({ ...r })) };
        if (sorted.length > limit) {
          const last = page[page.length - 1] as Row;
          out.LastEvaluatedKey = { pk: last.pk, sk: last.sk };
        }
        return out;
      }
      default:
        throw new Error(`MemoryDynamo: unsupported command ${command.constructor.name}`);
    }
  }) as unknown as DocClient["send"];
}
