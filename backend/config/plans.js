export const PDF_DOCUMENT_TYPES = [
  {
    id: 'offer',
    labelKey: 'pdf_document_offer',
    fileNamePart: 'offer',
  },
  {
    id: 'confirmation',
    labelKey: 'pdf_document_confirmation',
    fileNamePart: 'confirmation',
  },
];

const PDF_DOCUMENT_IDS = PDF_DOCUMENT_TYPES.map(documentType => documentType.id);

export const PLANS = [
  {
    id: 'plan-free',
    name: 'Free',
    monthlyGenerationLimit: 100,
    priceCzk: 0,
    originalPriceCzk: 199,
    discountPercent: 100,
    description: '100 tokens per month with manual paid upgrade available',
    pdfProfile: 'free',
    pdfQuality: 'basic',
    pdfDocuments: PDF_DOCUMENT_IDS,
  },
  {
    id: 'plan-25',
    name: 'Silver',
    monthlyGenerationLimit: 300,
    priceCzk: 229,
    originalPriceCzk: 299,
    discountPercent: 23,
    description: '300 tokens per month',
    pdfProfile: 'starter',
    pdfQuality: 'essential',
    pdfDocuments: PDF_DOCUMENT_IDS,
  },
  {
    id: 'plan-50',
    name: 'Gold',
    monthlyGenerationLimit: 500,
    priceCzk: 379,
    originalPriceCzk: 499,
    discountPercent: 24,
    description: '500 tokens per month',
    pdfProfile: 'growth',
    pdfQuality: 'branded',
    pdfDocuments: PDF_DOCUMENT_IDS,
  },
  {
    id: 'plan-100',
    name: 'Platinum',
    monthlyGenerationLimit: 1000,
    priceCzk: 699,
    originalPriceCzk: 899,
    discountPercent: 22,
    description: '1000 tokens per month',
    pdfProfile: 'scale',
    pdfQuality: 'premium',
    pdfDocuments: PDF_DOCUMENT_IDS,
  },
];

export const DEFAULT_PLAN_ID = PLANS[0].id;

export function getPlanById(planId) {
  return PLANS.find(plan => plan.id === planId) || null;
}

export function isSupportedPdfDocumentType(documentType) {
  return PDF_DOCUMENT_TYPES.some(item => item.id === documentType);
}

export function getPdfDocumentType(documentType = 'confirmation') {
  return (
    PDF_DOCUMENT_TYPES.find(item => item.id === documentType) ||
    PDF_DOCUMENT_TYPES.find(item => item.id === 'confirmation') ||
    null
  );
}
