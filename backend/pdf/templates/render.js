import { getPdfMessage, normalizePdfLanguage } from "../i18n.js";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
}

function renderText(value, fallback = "—") {
  return escapeHtml(normalizeText(value, fallback));
}

function renderMultilineText(value, fallback = "—") {
  return renderText(value, fallback).replaceAll("\n", "<br />");
}

function getObjectValue(value, keys = ["address", "name", "value"]) {
  if (!value || typeof value !== "object") {
    return normalizeText(value);
  }

  for (const key of keys) {
    if (value[key]) {
      return normalizeText(value[key]);
    }
  }

  return "—";
}

function getTripAddress(value) {
  return getObjectValue(value, ["address", "name", "value"]);
}

function localDateOnly(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function subtractDaysFromDateOnly(value, days) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() - days);
  return localDateOnly(date);
}

function normalizeDateOnly(value) {
  if (!value) {
    return localDateOnly();
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (match) {
    return match[1];
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return localDateOnly(parsed);
  }

  return text;
}

function normalizeDateTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "—";

  const match = text.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/,
  );

  if (match) {
    return match[2] ? `${match[1]} ${match[2]}` : match[1];
  }

  return text;
}

function renderRows(rows) {
  return rows
    .map(
      (row) => `
        <p class="key">${escapeHtml(row.label)}</p>
        <p class="value${row.multiline ? " value--multiline" : ""}">${renderMultilineText(row.value)}</p>
      `,
    )
    .join("");
}

function buildContractCompany(contractData = {}) {
  const provider =
    contractData?.provider && typeof contractData.provider === "object"
      ? contractData.provider
      : {};
  const company =
    contractData?.company && typeof contractData.company === "object"
      ? contractData.company
      : {};

  return {
    name: normalizeText(company.name || provider.name || "DocTra", "DocTra"),
    email: normalizeText(company.email || "—"),
    phone: normalizeText(company.phone || "—"),
  };
}

function buildTripPaymentMethod(contractData = {}, fallback = "hotovost / kartou na místě") {
  return normalizeText(
    contractData?.trip?.paymentMethod ||
      contractData?.paymentMethod ||
      fallback,
    fallback,
  );
}

function buildHeaderSubtitle(orderNumber, today, t) {
  return `
    <div class="muted">#<strong>${renderText(orderNumber, "—")}</strong></div>
    <div class="muted">${escapeHtml(t("header.issued"))}: <strong>${renderText(today)}</strong></div>
  `;
}

export function renderContractPdfHtml({
  contractData = {},
  plan,
  documentType,
  language = "cs",
}) {
  const resolvedLanguage = normalizePdfLanguage(language);
  const t = (key, values) => {
    const template = getPdfMessage(resolvedLanguage, key);

    return String(template).replace(/\{(\w+)\}/g, (_, placeholder) => {
      const value = values?.[placeholder];
      return value == null ? "" : String(value);
    });
  };
  const resolvedDocumentType =
    documentType === "offer" ? "offer" : "confirmation";
  const orderNumber = normalizeText(contractData?.orderNumber || "—");
  const issueDate =
    subtractDaysFromDateOnly(contractData?.trip?.time, 3) ||
    normalizeDateOnly(contractData?.today || new Date());
  const company = buildContractCompany(contractData);
  const fullTitle = t(`document.${resolvedDocumentType}Heading`);
  const pageTitle = t(`document.${resolvedDocumentType}Title`);

  const driverName = normalizeText(contractData?.driver?.name);
  const driverAddress = normalizeText(contractData?.driver?.address);
  const driverSpz = normalizeText(contractData?.driver?.spz);
  const driverIco = normalizeText(contractData?.driver?.ico);
  const driverDic = normalizeText(contractData?.driver?.dic || contractData?.driver?.dicVat);

  const providerName = normalizeText(contractData?.provider?.name);
  const providerAddress = normalizeText(contractData?.provider?.address);
  const providerIco = normalizeText(contractData?.provider?.ico);
  const providerDic = normalizeText(contractData?.provider?.dic || contractData?.provider?.dicVat);

  const customerName = normalizeText(contractData?.customer?.name);
  const customerEmail = normalizeText(
    contractData?.customer?.email || contractData?.customer?.phone,
  );
  const customerBirthDate = normalizeText(
    contractData?.customer?.birthDate || contractData?.customer?.dateOfBirth,
    "",
  );
  const customerAddress = normalizeText(
    contractData?.customer?.address || contractData?.customer?.residentialAddress,
    "",
  );
  const passengers = normalizeText(
    contractData?.passengers ??
      contractData?.customers ??
      contractData?.customersCount ??
      contractData?.trip?.passengers ??
      contractData?.trip?.customers ??
      contractData?.trip?.customersCount,
  );

  const pickupAddress = getTripAddress(contractData?.trip?.from);
  const dropoffAddress = getTripAddress(contractData?.trip?.to);
  const tripTime = normalizeDateTime(contractData?.trip?.time);
  const totalPrice = normalizeText(contractData?.totalPrice);
  const paymentMethod = buildTripPaymentMethod(contractData, t("paymentMethod"));

  return `
    <!doctype html>
    <html lang="${escapeHtml(resolvedLanguage)}" style="background-color: #727272;">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(pageTitle)}</title>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @page {
            size: A4;
            margin: 0;
          }

          html {
            background: #727272;
          }

          body {
            width: ${A4_WIDTH_PX}px;
            height: ${A4_HEIGHT_PX}px;
            margin: 0 auto;
            background-color: #fff;
            position: relative;
            font-family: Arial, sans-serif;
            color: #111;
            padding: 34px 28px 24px 28px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
          }

          h1,
          h2,
          h3,
          p {
            padding: 0;
            margin: 0;
          }

          .contract {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
          }

          .left-container {
            max-width: 70%;
          }

          .title {
            font-weight: 900;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 34px;
            line-height: 1.05;
            letter-spacing: -0.02em;
          }

          .muted {
            font-size: 12px;
            margin: 3px 22px;
            color: #444;
          }

          section {
            margin-top: 32px;
          }

          .subtitle {
            font-size: 18px;
            font-weight: 700;
            font-family: Georgia, "Times New Roman", serif;
          }

          .grid-1,
          .grid-2 {
            display: grid;
            grid-template-columns: 130px auto;
            gap: 0 10px;
            margin-top: 8px;
          }

          .grid-2 {
            grid-template-columns: 130px 220px;
          }

          .key,
          .value {
            height: auto;
            margin: 3px 0;
            padding-left: 10px;
            display: flex;
            align-items: flex-end;
          }

          .key {
            font-size: 14px;
            font-weight: 500;
            color: #111;
          }

          .value {
            font-size: 16px;
            color: #727272;
            font-weight: 500;
            border-bottom: 1px dashed;
            min-height: 22px;
          }

          .value--multiline {
            line-height: 1.28;
            align-items: flex-start;
            padding-bottom: 2px;
          }

          .contract-notice {
            margin-top: auto;
            font-size: 14px;
            color: #444;
            margin-top: 8px;
          }

          .bottomArea {
            margin-top: 18px;
          }

          .date {
            width: 30%;
            margin: 92px 48px 0 auto;
          }

          .dateRow {
            display: flex;
            justify-content: flex-end;
            align-items: flex-end;
          }

          .dateRow .contract-notice {
            margin-top: 0;
            margin-right: 16px;
          }

          .dateRow .value {
            min-width: 100px;
          }

          .signatures {
            display: grid;
            justify-items: center;
            grid-template-columns: auto auto;
            justify-content: space-between;
            gap: 0 50px;
            margin-top: 14px;
          }

          .signature {
            display: flex;
            align-items: center;
          }

          .signature .value {
            min-width: 120px;
            height: 15px;
            border-bottom: 2px solid;
            margin-left: 10px;
            padding: 0;
          }

          footer {
            margin-top: 10px;
            text-align: center;
            color: #666;
            font-size: 12px;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <main class="contract">
          <div class="left-container">
            <div class="header">
              <h1 class="title">${escapeHtml(fullTitle)}</h1>
              ${buildHeaderSubtitle(orderNumber, issueDate, t)}
            </div>

            <section class="driver">
              <h2 class="subtitle">${escapeHtml(t("subtitle.carrier"))}</h2>
              <div class="grid-1">
                ${renderRows([
                  { label: t("labels.name"), value: driverName },
                  { label: t("labels.address"), value: driverAddress },
                  { label: t("labels.vehiclePlate"), value: driverSpz },
                  { label: t("labels.ico"), value: driverIco },
                  { label: t("labels.dic"), value: driverDic },
                ])}
              </div>
            </section>

            <section class="provider">
              <h2 class="subtitle">${escapeHtml(t("subtitle.provider"))}</h2>
              <div class="grid-1">
                ${renderRows([
                  { label: t("labels.companyName"), value: providerName },
                  { label: t("labels.address"), value: providerAddress },
                  { label: t("labels.ico"), value: providerIco },
                  { label: t("labels.dic"), value: providerDic },
                ])}
              </div>
            </section>

            <section class="customer">
              <h2 class="subtitle">${escapeHtml(t("subtitle.customer"))}</h2>
              <div class="grid-1">
                ${renderRows([
                  { label: t("labels.name"), value: customerName },
                  { label: t("labels.emailPhone"), value: customerEmail },
                  ...(customerBirthDate
                    ? [{ label: t("labels.birthDate"), value: customerBirthDate }]
                    : []),
                  ...(customerAddress
                    ? [
                        {
                          label: t("labels.residentialAddress"),
                          value: customerAddress,
                          multiline: true,
                        },
                      ]
                    : []),
                  { label: t("labels.passengers"), value: passengers },
                ])}
              </div>
            </section>

            <section class="trip">
              <h2 class="subtitle">${escapeHtml(t("subtitle.trip"))}</h2>
              <div class="grid-1">
                ${renderRows([
                  {
                    label: t("labels.pickup"),
                    value: pickupAddress,
                    multiline: true,
                  },
                  {
                    label: t("labels.dropoff"),
                    value: dropoffAddress,
                    multiline: true,
                  },
                  { label: t("labels.datetime"), value: tripTime },
                ])}
              </div>

              <div class="grid-1 grid-2" style="margin-top: 14px;">
                ${renderRows([
                  { label: t("labels.price"), value: totalPrice },
                  { label: t("labels.payment"), value: paymentMethod },
                ])}
              </div>
            </section>
          </div>

          <div class="bottomArea">
            <p class="contract-notice">${escapeHtml(t("notice"))}</p>

            <div class="date">
              <div class="dateRow">
                <p class="contract-notice">${escapeHtml(t("issuedIn"))}</p>
                <p class="value">${escapeHtml(issueDate)}</p>
              </div>
            </div>

            <div class="signatures">
              <div class="signature">
                <p class="contract-notice">${escapeHtml(t("carrierSignature"))}</p>
                <p class="value">${renderText(driverName)}</p>
              </div>
              <div class="signature">
                <p class="contract-notice">${escapeHtml(t("customerSignature"))}</p>
                <p class="value">${renderText(customerName)}</p>
              </div>
            </div>
          </div>
        </main>
      </body>
    </html>
  `;
}
