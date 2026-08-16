import { requireManager } from '../../auth/context.js';
import {
  ARCHIVED_ORDER_LIST_WITH_OWNER_SELECT,
  ARCHIVED_ORDER_WITH_OWNER_INCLUDE,
  ORDER_WITH_OWNER_INCLUDE,
  ORDER_LIST_WITH_OWNER_SELECT,
  createAuditLog,
  sanitizeOrderListRecord,
  sanitizeOrderRecord,
} from '../../db/prisma-helpers.js';
import { prisma } from '../../db/prisma.js';
import { sendJson } from '../../lib/http.js';
import { hasFlightStatusAccess } from '../../services/flight-status.js';
import {
  buildManagerOrdersSummary,
  matchesManagerOrderStatus,
} from '../../services/orders.js';
import { normalizePaginationParams, normalizeText } from '../../validation/common.js';

function getOrderSanitizeOptions(user) {
  return {
    includeFlightStatus: hasFlightStatusAccess(user),
  };
}

function normalizeOrderCollectionState(value) {
  const state = normalizeText(value).toLowerCase();

  if (state === 'deleted' || state === 'archived') {
    return 'deleted';
  }

  return 'active';
}

function getOrderCollectionConfig(state) {
  if (state === 'deleted') {
    return {
      model: prisma.archivedOrder,
      select: ARCHIVED_ORDER_LIST_WITH_OWNER_SELECT,
    };
  }

  return {
    model: prisma.order,
    select: ORDER_LIST_WITH_OWNER_SELECT,
  };
}

export async function handleManagerOrders(request, response, url) {
  const context = await requireManager(request, response);
  if (!context) return;

  const search = normalizeText(url.searchParams.get('search')).toLowerCase();
  const status = normalizeText(url.searchParams.get('status')).toLowerCase();
  const userId = normalizeText(url.searchParams.get('userId'));
  const state = normalizeOrderCollectionState(url.searchParams.get('state'));
  const { skip, limit } = normalizePaginationParams(url.searchParams);
  const { model, select } = getOrderCollectionConfig(state);
  const baseWhere = userId
    ? {
        userId,
      }
    : undefined;

  const [candidateOrders, totalCount] = await Promise.all([
    model.findMany({
      where: baseWhere,
      select,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    search ? Promise.resolve(null) : model.count({ where: baseWhere }),
  ]);

  const scopedOrders = candidateOrders.filter(order => {
    if (!search) {
      return true;
    }

    const owner = order.user;
    const haystack = [
      order.orderNumber,
      order.customer?.name,
      order.customer?.email,
      order.trip?.from,
      order.trip?.to,
      owner?.name,
      owner?.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  });

  const summary = buildManagerOrdersSummary(scopedOrders);
  if (Number.isInteger(totalCount)) {
    summary.all = totalCount;
  }
  const orders = scopedOrders
    .filter(order => matchesManagerOrderStatus(order, status))
    .map(order => sanitizeOrderListRecord(order, getOrderSanitizeOptions(context.user)));

  sendJson(response, 200, { orders, summary });
}

export async function handleManagerOrderDetail(request, response, orderId, url) {
  const context = await requireManager(request, response);
  if (!context) return;

  const resolvedOrderId = normalizeText(orderId);
  const state = normalizeOrderCollectionState(url?.searchParams?.get('state'));

  if (!resolvedOrderId) {
    sendJson(response, 400, { error: 'Order ID is required' });
    return;
  }

  const order = await (async () => {
    if (state === 'deleted') {
      return prisma.archivedOrder.findUnique({
        where: {
          id: resolvedOrderId,
        },
        include: ARCHIVED_ORDER_WITH_OWNER_INCLUDE,
      });
    }

    const activeOrder = await prisma.order.findUnique({
      where: {
        id: resolvedOrderId,
      },
      include: ORDER_WITH_OWNER_INCLUDE,
    });

    if (activeOrder) {
      return activeOrder;
    }

    return prisma.archivedOrder.findUnique({
      where: {
        id: resolvedOrderId,
      },
      include: ARCHIVED_ORDER_WITH_OWNER_INCLUDE,
    });
  })();

  if (!order) {
    sendJson(response, 404, { error: 'Order not found' });
    return;
  }

  sendJson(response, 200, {
    order: sanitizeOrderRecord(order, getOrderSanitizeOptions(context.user)),
  });
}

export async function handleManagerOrderRestore(request, response, orderId) {
  const context = await requireManager(request, response);
  if (!context) return;

  const resolvedOrderId = normalizeText(orderId);

  if (!resolvedOrderId) {
    sendJson(response, 400, { error: 'Order ID is required' });
    return;
  }

  const restoredOrder = await prisma.$transaction(async tx => {
    const archivedOrder = await tx.archivedOrder.findUnique({
      where: {
        id: resolvedOrderId,
      },
      include: ARCHIVED_ORDER_WITH_OWNER_INCLUDE,
    });

    if (!archivedOrder) {
      throw new Error('Archived order not found');
    }

    const existingOrder = await tx.order.findUnique({
      where: {
        id: resolvedOrderId,
      },
    });

    if (existingOrder) {
      throw new Error('Order already exists');
    }

      const created = await tx.order.create({
        data: {
          id: archivedOrder.id,
          userId: archivedOrder.userId,
          createdByUserId: archivedOrder.createdByUserId,
          createdBySnapshot: archivedOrder.createdBySnapshot,
          orderNumber: archivedOrder.orderNumber,
          status: archivedOrder.status,
          flightNumber: archivedOrder.flightNumber,
          source: archivedOrder.source,
        customer: archivedOrder.customer,
        trip: archivedOrder.trip,
        totalPrice: archivedOrder.totalPrice,
        pdf: archivedOrder.pdf,
        contractData: archivedOrder.contractData,
        metadata: archivedOrder.metadata,
        createdAt: archivedOrder.createdAt,
        updatedAt: archivedOrder.updatedAt,
      },
      include: ORDER_WITH_OWNER_INCLUDE,
    });

    await tx.archivedOrder.delete({
      where: {
        id: archivedOrder.id,
      },
    });

      await createAuditLog(tx, {
        action: 'order.restored',
        actorUserId: context.user.id,
        targetUserId: archivedOrder.userId,
        entityType: 'order',
        entityId: archivedOrder.id,
        before: {
          status: archivedOrder.status,
          orderNumber: archivedOrder.orderNumber,
          flightNumber: archivedOrder.flightNumber,
        },
        after: {
          status: created.status,
          orderNumber: created.orderNumber,
          flightNumber: created.flightNumber,
        },
      });

    return sanitizeOrderRecord(created, getOrderSanitizeOptions(context.user));
  });

  sendJson(response, 200, {
    order: restoredOrder,
  });
}
