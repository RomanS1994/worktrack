function toDate(value, fallback = new Date()) {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed;
}

export function serializePlanRecord(record) {
  return {
    id: record.id,
    name: record.name,
    monthlyGenerationLimit: Number(record.monthlyGenerationLimit || 0),
    description: record.description || '',
    isActive: record.isActive !== false,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
  };
}
