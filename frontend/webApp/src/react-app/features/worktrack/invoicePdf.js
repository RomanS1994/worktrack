function cleanFileName(value) {
  return String(value || 'faktura')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'faktura';
}

export function invoicePdfFileName(invoice) {
  return `${cleanFileName(invoice?.invoiceNumber || 'faktura')}.pdf`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadInvoicePdf(blob, invoice) {
  if (!(blob instanceof Blob)) throw new Error('Invoice PDF is unavailable');
  downloadBlob(blob, invoicePdfFileName(invoice));
}

export async function shareInvoicePdf(blob, invoice) {
  if (!(blob instanceof Blob)) throw new Error('Invoice PDF is unavailable');
  const fileName = invoicePdfFileName(invoice);
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ files: [file], title: invoice.invoiceNumber || 'Faktura', text: `Faktura ${invoice.invoiceNumber || ''}`.trim() });
    return { shared: true };
  }
  downloadBlob(blob, fileName);
  return { shared: false };
}
