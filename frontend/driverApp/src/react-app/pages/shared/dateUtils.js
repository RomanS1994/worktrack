export function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00`
    : /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(text)
      ? text.replace(' ', 'T')
      : text;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getDateKey(value) {
  const date = parseDateValue(value);

  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(value) {
  const date = parseDateValue(value);

  if (!date) {
    return '-';
  }

  const datePart = date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${datePart}, ${timePart}`;
}

export function getOrderDate(order) {
  return order?.trip?.time || order?.contractData?.trip?.time || '';
}
