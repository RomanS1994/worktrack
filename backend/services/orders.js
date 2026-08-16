import { randomUUID } from 'node:crypto';

import { nowIso } from '../validation/common.js';

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getUserOrderCode(user) {
  const source = stripAccents([user?.name, user?.email].filter(Boolean).join(' ')).toUpperCase();
  const parts = source.match(/[A-Z0-9]+/g) || [];

  if (parts.length >= 2) {
    return `${parts[0][0] || 'X'}${parts[parts.length - 1][0] || 'X'}`;
  }

  if (parts.length === 1) {
    return (parts[0].slice(0, 2) || 'XX').padEnd(2, 'X');
  }

  return 'XX';
}

function formatOrderDate(createdAt) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return nowIso().slice(0, 10).replace(/-/g, '');
  }

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatOrderSequence(sequence) {
  const value = Number.parseInt(sequence, 10);
  if (!Number.isFinite(value) || value < 1) {
    return '01';
  }

  return String(value).padStart(2, '0');
}

function generateOrderNumber(user, createdAt, sequence = 1) {
  const initials = getUserOrderCode(user);
  const datePart = formatOrderDate(createdAt);
  const sequencePart = formatOrderSequence(sequence);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `ORD-${initials}-${datePart}-${sequencePart}-${suffix}`;
}

export function buildOrderCreatorSnapshot(user) {
  return {
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
  };
}

function getCustomerPayload(body = {}, contractData = {}) {
  const contractCustomer =
    contractData.customer && typeof contractData.customer === 'object'
      ? contractData.customer
      : {};
  const bodyCustomer =
    body.customer && typeof body.customer === 'object' ? body.customer : {};

  return {
    name: contractCustomer.name || bodyCustomer.name || '',
    email:
      contractCustomer.email ||
      bodyCustomer.email ||
      contractCustomer.phone ||
      '',
    phone: contractCustomer.phone || bodyCustomer.phone || '',
    birthDate:
      contractCustomer.birthDate ||
      contractCustomer.dateOfBirth ||
      bodyCustomer.birthDate ||
      bodyCustomer.dateOfBirth ||
      '',
    address:
      contractCustomer.address ||
      contractCustomer.residentialAddress ||
      bodyCustomer.address ||
      bodyCustomer.residentialAddress ||
      '',
  };
}

function getPaymentMethodPayload(body = {}, contractData = {}) {
  return (
    contractData.trip?.paymentMethod ||
    contractData.trip?.paymentType ||
    contractData.trip?.payment ||
    contractData.paymentMethod ||
    contractData.paymentType ||
    contractData.payment ||
    body.trip?.paymentMethod ||
    body.trip?.paymentType ||
    body.trip?.payment ||
    body.paymentMethod ||
    body.paymentType ||
    body.payment ||
    ''
  );
}

export function buildOrderRecord(body, user, options = {}) {
  const contractData = body.contractData || body.order || {};
  const createdAt = options.createdAt || nowIso();
  const orderSequence = options.orderSequence || 1;
  const flightNumber =
    body.flightNumber ||
    contractData.flightNumber ||
    body.order?.flightNumber ||
    '';
  const paymentMethod = getPaymentMethodPayload(body, contractData);
  const contractTrip =
    contractData.trip && typeof contractData.trip === 'object'
      ? contractData.trip
      : {};

  return {
    id: randomUUID(),
    userId: user.id,
    createdByUserId: user.id,
    createdBySnapshot: buildOrderCreatorSnapshot(user),
    orderNumber: generateOrderNumber(user, createdAt, orderSequence),
    status: body.status || 'created',
    flightNumber,
    source: body.source || 'pdf-app',
    customer: getCustomerPayload(body, contractData),
    trip: {
      from: contractData.trip?.from?.address || body.trip?.from || '',
      to: contractData.trip?.to?.address || body.trip?.to || '',
      time: contractData.trip?.time || body.trip?.time || '',
      paymentMethod,
    },
    totalPrice: contractData.totalPrice || body.totalPrice || '',
    pdf: {
      url: body.pdf?.url || body.pdfUrl || '',
      fileName: body.pdf?.fileName || body.pdfFileName || '',
    },
    contractData: {
      ...contractData,
      flightNumber,
      trip: {
        ...contractTrip,
        paymentMethod: contractTrip.paymentMethod || paymentMethod,
      },
    },
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
    createdAt,
    updatedAt: createdAt,
  };
}

export function matchesManagerOrderStatus(order, status) {
  if (!status || status === 'all') return true;

  const value = String(order.status || '').toLowerCase();

  if (status === 'generated') {
    return value === 'pdf_generated';
  }

  if (status === 'failed') {
    return value.includes('fail');
  }

  if (status === 'pending') {
    return value !== 'pdf_generated' && !value.includes('fail');
  }

  return value === status;
}

export function buildManagerOrdersSummary(orders) {
  return orders.reduce(
    (summary, order) => {
      summary.all += 1;

      if (matchesManagerOrderStatus(order, 'generated')) {
        summary.generated += 1;
      } else if (matchesManagerOrderStatus(order, 'failed')) {
        summary.failed += 1;
      } else {
        summary.pending += 1;
      }

      return summary;
    },
    {
      all: 0,
      pending: 0,
      failed: 0,
      generated: 0,
    }
  );
}
