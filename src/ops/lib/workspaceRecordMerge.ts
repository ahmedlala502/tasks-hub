type WorkspaceEntity = Record<string, unknown> & {
  id?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getEntityId(item: WorkspaceEntity): string {
  return typeof item.id === 'string' ? item.id.trim() : '';
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getEntityTime(item: WorkspaceEntity): number {
  return Math.max(toTimestamp(item.updatedAt), toTimestamp(item.createdAt));
}

export function mergeWorkspaceRecordsById<T extends WorkspaceEntity>(
  remotePayload: unknown,
  localPayload: unknown,
  deletedIds: string[] = [],
): T[] {
  const merged = new Map<string, T>();
  const anonymous: T[] = [];
  const deleted = new Set(deletedIds.map((id) => id.trim()).filter(Boolean));

  const add = (item: T) => {
    const id = getEntityId(item);
    if (id && deleted.has(id)) return;
    if (!id) {
      anonymous.push(item);
      return;
    }

    const existing = merged.get(id);
    if (!existing || getEntityTime(item) >= getEntityTime(existing)) {
      merged.set(id, item);
    }
  };

  asArray<T>(remotePayload).forEach(add);
  asArray<T>(localPayload).forEach(add);

  return [...merged.values(), ...anonymous];
}

export function parseWorkspaceRecordPayload<T>(payload: unknown): T[] {
  return asArray<T>(payload);
}
