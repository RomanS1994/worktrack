import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';

pdfMake.addVirtualFileSystem(pdfFonts);

const STATUS_COPY = {
  DRAFT: 'Koncept',
  SENT: 'Odesláno',
  VIEWED: 'Zobrazeno',
  PAID: 'Zaplaceno',
  CANCELLED: 'Zrušeno',
};

function money(value, currency = 'CZK') {
  return `${Number(value || 0).toLocaleString('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function hasMixedRates(items = []) {
  return new Set(items.map(item => Number(item.hourlyRate || 0).toFixed(2))).size > 1;
}

function partyBlock(title, party = {}, { showAccount = false } = {}) {
  const rows = [
    { text: title, style: 'sectionLabel' },
    { text: party.businessName || party.name || '—', style: 'partyName', margin: [0, 3, 0, 4] },
    { text: party.address || '—', style: 'muted' },
    { text: `IČO: ${party.ico || '—'}${party.dic ? `   DIČ: ${party.dic}` : ''}`, style: 'muted', margin: [0, 2, 0, 0] },
  ];
  if (party.email) rows.push({ text: party.email, style: 'muted', margin: [0, 2, 0, 0] });
  if (showAccount) rows.push({ text: `Účet / IBAN: ${party.iban || '—'}`, style: 'muted', margin: [0, 2, 0, 0] });
  return { stack: rows };
}

function buildDocument(invoice) {
  const items = invoice.items || [];
  const mixedRates = hasMixedRates(items);
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const rateText = mixedRates ? 'Více sazeb' : `${money(invoice.hourlyRate, invoice.currency)} / h`;
  const itemRows = [
    [
      { text: 'Datum', style: 'tableHead' },
      { text: 'Popis práce', style: 'tableHead' },
      { text: 'Hodiny', style: 'tableHead', alignment: 'right' },
      { text: 'Sazba', style: 'tableHead', alignment: 'right' },
      { text: 'Částka', style: 'tableHead', alignment: 'right' },
    ],
    ...items.map(item => [
      { text: item.workDate || '—', style: 'tableCell' },
      { text: item.description || 'Práce', style: 'tableCell' },
      { text: `${item.hours || '0.00'} h`, style: 'tableCell', alignment: 'right' },
      { text: money(item.hourlyRate, invoice.currency), style: 'tableCell', alignment: 'right' },
      { text: money(item.amount, invoice.currency), style: 'tableCell', alignment: 'right' },
    ]),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [42, 42, 42, 48],
    info: {
      title: invoice.invoiceNumber || 'Faktura',
      author: seller.businessName || 'WorkTrack',
      subject: 'Faktura a výkaz odpracovaných hodin',
      keywords: 'faktura, výkaz hodin, WorkTrack',
    },
    footer(currentPage, pageCount) {
      return {
        columns: [
          { text: invoice.invoiceNumber || '', style: 'footerText' },
          { text: `${currentPage} / ${pageCount}`, style: 'footerText', alignment: 'right' },
        ],
        margin: [42, 0, 42, 18],
      };
    },
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{
            columns: [
              { stack: [{ text: 'WorkTrack', style: 'brand' }, { text: 'FAKTURA', style: 'title', margin: [0, 6, 0, 0] }] },
              { stack: [{ text: invoice.invoiceNumber || '—', style: 'invoiceNumber', alignment: 'right' }, { text: STATUS_COPY[invoice.status] || 'Faktura', style: 'status', alignment: 'right', margin: [0, 5, 0, 0] }], width: 190 },
            ],
          }]],
        },
        layout: {
          fillColor: '#f0f8f3',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 18,
          paddingRight: () => 18,
          paddingTop: () => 16,
          paddingBottom: () => 16,
        },
        margin: [0, 0, 0, 20],
      },
      {
        columns: [
          { ...partyBlock('DODAVATEL', seller, { showAccount: true }), width: '*' },
          { ...partyBlock('ODBĚRATEL', buyer), width: '*' },
        ],
        columnGap: 28,
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [{ text: 'Datum vystavení', style: 'metaLabel' }, { text: invoice.issueDate || '—', style: 'metaValue' }],
            [{ text: 'Datum splatnosti', style: 'metaLabel' }, { text: invoice.dueDate || '—', style: 'metaValue' }],
            [{ text: 'Období prací', style: 'metaLabel' }, { text: `${invoice.periodStart || '—'} — ${invoice.periodEnd || '—'}`, style: 'metaValue' }],
          ],
        },
        layout: {
          fillColor: rowIndex => (rowIndex % 2 ? '#ffffff' : '#f6faf7'),
          hLineColor: '#e0e9e3',
          vLineColor: '#e0e9e3',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 24, 0, 18],
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            columns: [
              {
                stack: [
                  { text: 'PLATEBNÍ ÚDAJE', style: 'sectionLabel' },
                  { text: `Účet / IBAN: ${seller.iban || '—'}`, style: 'paymentLine', margin: [0, 7, 0, 0] },
                  { text: `Variabilní symbol: ${invoice.variableSymbol || '—'}`, style: 'paymentLine', margin: [0, 4, 0, 0] },
                  { text: `Částka: ${money(invoice.subtotal, invoice.currency)}`, style: 'paymentLine', margin: [0, 4, 0, 0] },
                ],
                width: '*',
              },
              invoice.paymentDescriptor
                ? { stack: [{ qr: invoice.paymentDescriptor, fit: 94, alignment: 'right' }, { text: 'QR platba', style: 'qrCaption', alignment: 'right', margin: [0, 4, 0, 0] }], width: 120 }
                : { text: '', width: 120 },
            ],
            columnGap: 20,
          }]],
        },
        layout: {
          fillColor: '#f4f9f6',
          hLineColor: '#dbe9df',
          vLineColor: '#dbe9df',
          paddingLeft: () => 14,
          paddingRight: () => 14,
          paddingTop: () => 12,
          paddingBottom: () => 12,
        },
        margin: [0, 2, 0, 22],
      },
      {
        table: {
          widths: ['*', 100, 120],
          body: [[
            { text: 'Poskytnuté práce dle přiloženého výkazu hodin', style: 'serviceText' },
            { text: `${invoice.totalHours || '0.00'} h`, style: 'serviceValue', alignment: 'right' },
            { text: rateText, style: 'serviceValue', alignment: 'right' },
          ]],
        },
        layout: {
          fillColor: '#f7faf8',
          hLineColor: '#e1e9e4',
          vLineColor: '#e1e9e4',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 11,
          paddingBottom: () => 11,
        },
      },
      {
        columns: [
          { text: `${invoice.totalHours || '0.00'} h`, style: 'summaryMuted', margin: [0, 22, 0, 0] },
          {
            stack: [
              { text: 'CELKEM K ÚHRADĚ', style: 'totalLabel', alignment: 'right' },
              { text: money(invoice.subtotal, invoice.currency), style: 'totalValue', alignment: 'right', margin: [0, 5, 0, 0] },
            ],
            width: 220,
            margin: [0, 22, 0, 0],
          },
        ],
      },
      { text: 'PŘÍLOHA K FAKTUŘE', style: 'appendixKicker', pageBreak: 'before' },
      {
        columns: [
          { stack: [{ text: 'Výkaz odpracovaných hodin', style: 'appendixTitle' }, { text: `${invoice.periodStart || '—'} — ${invoice.periodEnd || '—'}`, style: 'muted', margin: [0, 5, 0, 0] }] },
          { text: invoice.invoiceNumber || '', style: 'invoiceNumberSmall', alignment: 'right', width: 170 },
        ],
        margin: [0, 5, 0, 18],
      },
      {
        table: { headerRows: 1, widths: [70, '*', 55, 78, 82], body: itemRows, dontBreakRows: true },
        layout: {
          fillColor: rowIndex => (rowIndex === 0 ? '#eaf5ed' : rowIndex % 2 === 0 ? '#f9fbfa' : null),
          hLineColor: '#dce6df',
          vLineColor: '#dce6df',
          paddingLeft: () => 7,
          paddingRight: () => 7,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
      },
      {
        columns: [
          { text: 'Celkem', style: 'totalLabel', margin: [0, 18, 0, 0] },
          { text: `${invoice.totalHours || '0.00'} h · ${money(invoice.subtotal, invoice.currency)}`, style: 'appendixTotal', alignment: 'right', margin: [0, 18, 0, 0] },
        ],
      },
    ],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1f2937' },
    styles: {
      brand: { fontSize: 11, bold: true, color: '#159447' },
      title: { fontSize: 25, bold: true, color: '#111827' },
      invoiceNumber: { fontSize: 15, bold: true, color: '#111827' },
      invoiceNumberSmall: { fontSize: 11, bold: true, color: '#111827' },
      status: { fontSize: 8, bold: true, color: '#36754a' },
      sectionLabel: { fontSize: 8, bold: true, color: '#667085' },
      partyName: { fontSize: 12, bold: true, color: '#111827' },
      muted: { fontSize: 8.5, color: '#5f6b7a', lineHeight: 1.25 },
      metaLabel: { fontSize: 8, bold: true, color: '#667085' },
      metaValue: { fontSize: 9, bold: true, color: '#111827' },
      paymentLine: { fontSize: 9, bold: true, color: '#263242' },
      qrCaption: { fontSize: 7.5, bold: true, color: '#667085' },
      serviceText: { fontSize: 9.5, bold: true, color: '#263242' },
      serviceValue: { fontSize: 9.5, bold: true, color: '#111827' },
      summaryMuted: { fontSize: 9, bold: true, color: '#667085' },
      totalLabel: { fontSize: 8.5, bold: true, color: '#667085' },
      totalValue: { fontSize: 20, bold: true, color: '#0f5132' },
      appendixKicker: { fontSize: 8, bold: true, color: '#159447' },
      appendixTitle: { fontSize: 20, bold: true, color: '#111827' },
      tableHead: { fontSize: 8, bold: true, color: '#355343' },
      tableCell: { fontSize: 8.5, color: '#263242' },
      appendixTotal: { fontSize: 12, bold: true, color: '#0f5132' },
      footerText: { fontSize: 7.5, color: '#98a2b3' },
    },
  };
}

export function invoicePdfFileName(invoice) {
  return `${String(invoice?.invoiceNumber || 'faktura').replace(/[^a-zA-Z0-9._-]+/g, '-')}.pdf`;
}

export async function generateInvoicePdfBuffer(invoice) {
  const buffer = await pdfMake.createPdf(buildDocument(invoice)).getBuffer();
  return Buffer.from(buffer);
}
