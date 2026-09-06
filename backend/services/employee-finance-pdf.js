import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';

pdfMake.addVirtualFileSystem(pdfFonts);

function safeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return `${safeNumber(value).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Kč`;
}

function hours(value) {
  return `${safeNumber(value).toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} h`;
}

function buildDocument(report = {}) {
  const language = ['uk', 'cs', 'en'].includes(report.language) ? report.language : 'uk';
  const copy = {
    uk: { title: 'Звіт по зарплаті', period: 'Період', company: 'Компанія', total: 'Всього годин', confirmed: 'Підтверджено', pending: 'Очікує підтвердження', advances: 'Залоги', payable: 'До виплати', rate: 'Ставка', note: 'Податки та інші відрахування не враховано.' },
    cs: { title: 'Mzdový přehled', period: 'Období', company: 'Společnost', total: 'Celkem hodin', confirmed: 'Potvrzeno', pending: 'Čeká na potvrzení', advances: 'Zálohy', payable: 'K výplatě', rate: 'Sazba', note: 'Daně a další odvody nejsou zahrnuty.' },
    en: { title: 'Payroll report', period: 'Period', company: 'Company', total: 'Total hours', confirmed: 'Confirmed', pending: 'Pending confirmation', advances: 'Advances', payable: 'Net payable', rate: 'Rate', note: 'Taxes and other deductions are not included.' },
  }[language];

  const rows = [
    [copy.total, hours(report.totalHours)],
    [copy.confirmed, `${hours(report.approvedHours)} · ${money(report.confirmedSalary)}`],
    [copy.pending, `${hours(report.pendingHours)} · ${money(report.pendingSalary)}`],
    [copy.advances, `− ${money(report.advanceAmount)}`],
    [copy.rate, `${money(report.hourlyRate)} / h`],
  ];

  return {
    pageSize: 'A4',
    pageMargins: [42, 42, 42, 48],
    info: {
      title: `${copy.title} - ${safeText(report.periodLabel, '')}`.trim(),
      author: safeText(report.companyName, 'WorkTrack'),
      subject: copy.title,
    },
    content: [
      { text: 'WorkTrack', style: 'brand' },
      { text: copy.title, style: 'title', margin: [0, 6, 0, 20] },
      {
        table: {
          widths: [110, '*'],
          body: [
            [{ text: copy.company, style: 'metaLabel' }, { text: safeText(report.companyName), style: 'metaValue' }],
            [{ text: copy.period, style: 'metaLabel' }, { text: safeText(report.periodLabel), style: 'metaValue' }],
          ],
        },
        layout: {
          fillColor: row => row % 2 === 0 ? '#f6faf7' : '#ffffff',
          hLineColor: '#e0e9e3',
          vLineColor: '#e0e9e3',
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 0, 0, 20],
      },
      {
        table: {
          widths: ['*', 190],
          body: rows.map(([label, value]) => [
            { text: label, style: 'rowLabel' },
            { text: value, style: 'rowValue', alignment: 'right' },
          ]),
        },
        layout: {
          fillColor: row => row % 2 === 0 ? '#f9fbfa' : '#ffffff',
          hLineColor: '#e4ebe6',
          vLineColor: '#e4ebe6',
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 10,
          paddingBottom: () => 10,
        },
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: copy.payable, style: 'totalLabel' },
              { text: money(report.expectedSalary), style: 'totalValue', margin: [0, 5, 0, 0] },
            ],
          }]],
        },
        layout: {
          fillColor: '#f0f8f3',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 14,
          paddingBottom: () => 14,
        },
        margin: [0, 20, 0, 14],
      },
      { text: copy.note, style: 'note' },
    ],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1f2937' },
    styles: {
      brand: { fontSize: 11, bold: true, color: '#159447' },
      title: { fontSize: 24, bold: true, color: '#111827' },
      metaLabel: { fontSize: 9, bold: true, color: '#667085' },
      metaValue: { fontSize: 10, bold: true, color: '#111827' },
      rowLabel: { fontSize: 10, color: '#475467' },
      rowValue: { fontSize: 10, bold: true, color: '#111827' },
      totalLabel: { fontSize: 9, bold: true, color: '#667085' },
      totalValue: { fontSize: 22, bold: true, color: '#0f7f3b' },
      note: { fontSize: 9, color: '#667085' },
    },
  };
}

export function employeeFinancePdfFileName(report = {}) {
  const period = String(report.periodKey || report.periodLabel || 'report').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `worktrack-payroll-${period || 'report'}.pdf`;
}

export async function generateEmployeeFinancePdfBuffer(report) {
  const buffer = await pdfMake.createPdf(buildDocument(report)).getBuffer();
  return Buffer.from(buffer);
}
