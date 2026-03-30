export interface ItemInput {
  name: string;
  description?: string;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function validateItemInput(body: unknown): Validation<ItemInput> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof b.name !== "string" || b.name.trim() === "" || b.name.length > 100) {
    errors.push("name must be a non-empty string of at most 100 characters");
  }
  if (b.description !== undefined && (typeof b.description !== "string" || b.description.length > 1000)) {
    errors.push("description must be a string of at most 1000 characters");
  }
  if (errors.length > 0) return { ok: false, errors };
  const value: ItemInput = { name: (b.name as string).trim() };
  if (typeof b.description === "string") value.description = b.description;
  return { ok: true, value };
}

export function validateVersion(body: unknown): Validation<number> {
  const v = (body as Record<string, unknown> | null)?.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    return { ok: false, errors: ["version must be a positive integer (the version you last read)"] };
  }
  return { ok: true, value: v };
}

export function parseLimit(raw: string | undefined): Validation<number> {
  if (raw === undefined) return { ok: true, value: 25 };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return { ok: false, errors: ["limit must be an integer between 1 and 100"] };
  }
  return { ok: true, value: n };
}
