function readErrorText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

export function resolveErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === 'string') {
    return error;
  }

  const nestedData = error.data;
  if (typeof nestedData === 'string') {
    return nestedData;
  }

  if (nestedData && typeof nestedData === 'object') {
    const dataMessage =
      readErrorText(nestedData.error) ||
      readErrorText(nestedData.message) ||
      readErrorText(nestedData.detail);

    if (dataMessage) {
      return dataMessage;
    }
  }

  const directMessage =
    readErrorText(error.error) ||
    readErrorText(error.message);

  if (directMessage) {
    return directMessage;
  }

  return fallbackMessage;
}
