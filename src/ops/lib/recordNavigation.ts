export function clearRecordParam(params: URLSearchParams, key: string) {
  const next = new URLSearchParams(params);
  next.delete(key);
  return next;
}
