import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

export interface Item {
  id: string;
  name: string;
  description?: string;
  version: number;
  updatedAt: string;
}

export type ItemFields = Pick<Item, "id" | "name"> & { description?: string };

/** The only DynamoDBDocumentClient method the repo needs. The demo swaps in a fake. */
export type DocClient = Pick<DynamoDBDocumentClient, "send">;

export class ConflictError extends Error {
  constructor(message = "version conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidCursorError extends Error {
  constructor() {
    super("invalid cursor");
    this.name = "InvalidCursorError";
  }
}

const PK = "ITEM";

function isConditionFailure(e: unknown): boolean {
  return (e as { name?: string } | null)?.name === "ConditionalCheckFailedException";
}

function toItem(raw: Record<string, unknown>): Item {
  const { sk, ...rest } = raw;
  delete rest.pk;
  return { id: sk as string, ...rest } as Item;
}

export class ItemsRepo {
  constructor(
    private readonly db: DocClient,
    private readonly tableName: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Create when expectedVersion is omitted, update when given. Throws ConflictError on a clash. */
  async put(item: ItemFields, expectedVersion?: number): Promise<Item> {
    const next: Item = {
      ...item,
      version: (expectedVersion ?? 0) + 1,
      updatedAt: this.now().toISOString(),
    };
    const { id, ...attrs } = next;
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { pk: PK, sk: id, ...attrs },
          ConditionExpression:
            expectedVersion === undefined ? "attribute_not_exists(sk)" : "#v = :expected",
          ...(expectedVersion === undefined
            ? {}
            : {
                ExpressionAttributeNames: { "#v": "version" },
                ExpressionAttributeValues: { ":expected": expectedVersion },
              }),
        }),
      );
    } catch (e) {
      if (!isConditionFailure(e)) throw e;
      if (expectedVersion !== undefined && !(await this.get(id))) throw new NotFoundError();
      throw new ConflictError();
    }
    return next;
  }

  async get(id: string): Promise<Item | undefined> {
    const res = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: PK, sk: id } }),
    );
    return res.Item ? toItem(res.Item) : undefined;
  }

  async list(limit: number, cursor?: string): Promise<{ items: Item[]; nextCursor?: string }> {
    const startKey = cursor === undefined ? undefined : decodeCursor(cursor);
    const res = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": PK },
        Limit: limit,
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    const items = (res.Items ?? []).map(toItem);
    const last = res.LastEvaluatedKey;
    return last ? { items, nextCursor: encodeCursor(last) } : { items };
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pk: PK, sk: id },
          ConditionExpression: "attribute_exists(sk)",
        }),
      );
    } catch (e) {
      if (isConditionFailure(e)) throw new NotFoundError();
      throw e;
    }
  }
}

function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}

function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (typeof key === "object" && key !== null && typeof (key as { sk?: unknown }).sk === "string") {
      return { pk: PK, sk: (key as { sk: string }).sk };
    }
  } catch {
    // bad cursor, handled below
  }
  throw new InvalidCursorError();
}
