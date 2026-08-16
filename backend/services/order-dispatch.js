import { randomUUID } from 'node:crypto';

import {
  ORDER_WITH_OWNER_INCLUDE,
  createAuditLog,
  sanitizeOrderRecord,
} from '../db/prisma-helpers.js';
import { hasFlightStatusAccess } from './flight-status.js';
import {
  refreshFlightStatusForOrder,
  refreshFlightStatusesForOrders,
} from './flight-status-refresh.js';
import { normalizeUserProfile } from './profiles.js';
import { requireTeamFeatureAccess } from './team-access.js';
import { normalizeText, nowIso } from '../validation/common.js';

export const ORDER_OFFER_STATUS = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  RETURNED: 'returned',
  CANCELED: 'canceled',
};

export const ORDER_OFFER_TARGET_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  SKIPPED: 'skipped',
  EXPIRED: 'expired',
  CANCELED: 'canceled',
};

const DEFAULT_OFFER_TTL_MINUTES = 30;
const DISPATCH_TARGET_TYPES = new Set(['all', 'team', 'driver']);

const DISPATCH_DRIVER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  deletedAt: true,
  profile: true,
  updatedAt: true,
};

const BASIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
};

function toIsoString(value) {
  if (!value) return '';

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function sanitizeBasicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    role: user.role || '',
  };
}

function getOrderSanitizeOptions(user) {
  return {
    includeFlightStatus: hasFlightStatusAccess(user),
  };
}

export function buildOwnerContractBusinessPatch(user) {
  const profile = normalizeUserProfile(user?.profile, user?.name || '');

  return {
    driver: {
      name: profile.driver.name || user?.name || '',
      address: profile.driver.address || '',
      spz: profile.driver.spz || '',
      ico: profile.driver.ico || '',
      dic: profile.driver.dic || '',
    },
    provider: {
      id: profile.provider.id || profile.defaultProviderId || '',
      name: profile.provider.name || '',
      address: profile.provider.address || '',
      ico: profile.provider.ico || '',
      dic: profile.provider.dic || '',
    },
  };
}

function hasBusinessPartyData(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value.name || value.address || value.ico || value.dic)
  );
}

function buildAcceptedOrderContractData(contractData, owner) {
  const source = contractData && typeof contractData === 'object' ? contractData : {};
  const ownerPatch = buildOwnerContractBusinessPatch(owner);

  return {
    ...source,
    driver: ownerPatch.driver,
    provider: hasBusinessPartyData(source.provider) ? source.provider : ownerPatch.provider,
  };
}

export function sanitizeDispatchDriver(user) {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || '',
    avatarUrl: user.profile?.avatarUrl || '',
    profile: {
      avatarUrl: user.profile?.avatarUrl || '',
      driver: user.profile?.driver || {},
    },
    updatedAt: toIsoString(user.updatedAt),
  };
}

function normalizeTargetType(value) {
  const targetType = normalizeText(value).toLowerCase();

  if (!DISPATCH_TARGET_TYPES.has(targetType)) {
    throw new Error('Dispatch target type is required');
  }

  return targetType;
}

function resolveExpiresAt(body) {
  const rawMinutes = Number.parseInt(String(body?.expiresInMinutes || ''), 10);
  const ttlMinutes = Number.isFinite(rawMinutes) && rawMinutes > 0
    ? Math.min(rawMinutes, 24 * 60)
    : DEFAULT_OFFER_TTL_MINUTES;
  const expiresAt = new Date(nowIso());
  expiresAt.setUTCMinutes(expiresAt.getUTCMinutes() + ttlMinutes);
  return expiresAt;
}

function isEligibleDriver(user, excludeUserId = '') {
  return Boolean(
    user &&
      user.id &&
      user.id !== excludeUserId &&
      !user.deletedAt &&
      user.role !== 'admin'
  );
}

export async function searchDispatchDrivers(client, { search = '', excludeUserId = '' } = {}) {
  const query = normalizeText(search).toLowerCase();
  const drivers = await client.user.findMany({
    where: {
      deletedAt: null,
      role: {
        in: ['user', 'manager'],
      },
      ...(excludeUserId
        ? {
            id: {
              not: excludeUserId,
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    },
    select: DISPATCH_DRIVER_SELECT,
    orderBy: [
      {
        name: 'asc',
      },
      {
        email: 'asc',
      },
    ],
    take: 50,
  });

  return drivers.map(sanitizeDispatchDriver);
}

async function resolveAllDriverTargets(client, excludeUserId) {
  const drivers = await client.user.findMany({
    where: {
      deletedAt: null,
      role: {
        in: ['user', 'manager'],
      },
      id: {
        not: excludeUserId,
      },
    },
    select: DISPATCH_DRIVER_SELECT,
    orderBy: [
      {
        name: 'asc',
      },
      {
        email: 'asc',
      },
    ],
  });

  return {
    drivers: drivers.filter(driver => isEligibleDriver(driver, excludeUserId)),
    team: null,
  };
}

async function resolveDriverTarget(client, excludeUserId, targetUserId) {
  const driverId = normalizeText(targetUserId);
  if (!driverId) {
    throw new Error('Driver id is required');
  }

  const driver = await client.user.findUnique({
    where: {
      id: driverId,
    },
    select: DISPATCH_DRIVER_SELECT,
  });

  if (!driver || !isEligibleDriver(driver, excludeUserId)) {
    throw new Error(driver?.id === excludeUserId ? 'Cannot send order to the current driver' : 'Selected driver not found');
  }

  return {
    drivers: [driver],
    team: null,
  };
}

async function resolveTeamTargets(client, actorId, excludeUserId, targetTeamId) {
  const teamId = normalizeText(targetTeamId);
  if (!teamId) {
    throw new Error('Team id is required');
  }

  const actor = await client.user.findUnique({
    where: {
      id: actorId,
    },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  requireTeamFeatureAccess(actor);

  const team = await client.team.findFirst({
    where: {
      id: teamId,
      ownerUserId: actorId,
    },
    include: {
      members: {
        include: {
          user: {
            select: DISPATCH_DRIVER_SELECT,
          },
        },
      },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  return {
    drivers: team.members
      .map(member => member.user)
      .filter(driver => isEligibleDriver(driver, excludeUserId)),
    team: {
      id: team.id,
      name: team.name,
    },
  };
}

async function resolveOfferTargets(client, actorId, excludeUserId, body) {
  const targetType = normalizeTargetType(body?.targetType || body?.type);

  if (targetType === 'all') {
    return {
      targetType,
      ...(await resolveAllDriverTargets(client, excludeUserId)),
    };
  }

  if (targetType === 'driver') {
    return {
      targetType,
      ...(await resolveDriverTarget(client, excludeUserId, body?.targetUserId || body?.userId)),
    };
  }

  return {
    targetType,
    ...(await resolveTeamTargets(client, actorId, excludeUserId, body?.targetTeamId || body?.teamId)),
  };
}

async function cancelOpenOffersForOrder(client, orderId, canceledAt) {
  const openOffers = await client.orderOffer.findMany({
    where: {
      orderId,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    select: {
      id: true,
    },
  });
  const offerIds = openOffers.map(offer => offer.id);

  if (!offerIds.length) {
    return;
  }

  await client.orderOfferTarget.updateMany({
    where: {
      offerId: {
        in: offerIds,
      },
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    data: {
      status: ORDER_OFFER_TARGET_STATUS.CANCELED,
      respondedAt: canceledAt,
    },
  });
  await client.orderOffer.updateMany({
    where: {
      id: {
        in: offerIds,
      },
      status: ORDER_OFFER_STATUS.OPEN,
    },
    data: {
      status: ORDER_OFFER_STATUS.CANCELED,
      updatedAt: canceledAt,
    },
  });
}

export async function createOrderOffer(client, { actor, order, body }) {
  const createdAt = new Date(nowIso());
  const { targetType, drivers, team } = await resolveOfferTargets(client, actor.id, order.userId, body);

  if (!drivers.length) {
    throw new Error('No drivers found');
  }

  await cancelOpenOffersForOrder(client, order.id, createdAt);

  const offerId = randomUUID();
  const targetUserId = targetType === 'driver' ? drivers[0].id : null;
  const offer = await client.orderOffer.create({
    data: {
      id: offerId,
      orderId: order.id,
      fromUserId: order.userId,
      createdByUserId: actor.id,
      targetType,
      targetUserId,
      targetTeamId: team?.id || null,
      targetTeamName: team?.name || null,
      status: ORDER_OFFER_STATUS.OPEN,
      expiresAt: resolveExpiresAt(body),
      createdAt,
      updatedAt: createdAt,
    },
  });

  await client.orderOfferTarget.createMany({
    data: drivers.map(driver => ({
      id: randomUUID(),
      offerId,
      userId: driver.id,
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
      createdAt,
    })),
    skipDuplicates: true,
  });

  await client.order.update({
    where: {
      id: order.id,
    },
    data: {
      updatedAt: createdAt,
    },
  });

  await createAuditLog(client, {
    action: 'order.offer.created',
    actorUserId: actor.id,
    targetUserId: order.userId,
    entityType: 'order',
    entityId: order.id,
    before: {
      userId: order.userId,
      openOfferReplaced: true,
    },
    after: {
      offerId,
      targetType,
      targetUserId,
      targetTeamId: team?.id || '',
      targetsCount: drivers.length,
      expiresAt: toIsoString(offer.expiresAt),
    },
  });

  return {
    ...offer,
    targetsCount: drivers.length,
    targets: drivers.map(sanitizeDispatchDriver),
  };
}

async function returnExpiredOffer(client, offer, returnedAt) {
  await client.orderOfferTarget.updateMany({
    where: {
      offerId: offer.id,
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    data: {
      status: ORDER_OFFER_TARGET_STATUS.EXPIRED,
      respondedAt: returnedAt,
    },
  });
  await client.orderOffer.updateMany({
    where: {
      id: offer.id,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    data: {
      status: ORDER_OFFER_STATUS.RETURNED,
      updatedAt: returnedAt,
    },
  });
  await createAuditLog(client, {
    action: 'order.offer.returned',
    actorUserId: null,
    targetUserId: offer.fromUserId,
    entityType: 'order',
    entityId: offer.orderId,
    before: {
      offerId: offer.id,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    after: {
      offerId: offer.id,
      status: ORDER_OFFER_STATUS.RETURNED,
    },
    meta: {
      reason: 'expired',
    },
  });
}

export async function closeExpiredOrderOffers(client) {
  const returnedAt = new Date(nowIso());
  const expiredOffers = await client.orderOffer.findMany({
    where: {
      status: ORDER_OFFER_STATUS.OPEN,
      expiresAt: {
        lte: returnedAt,
      },
    },
    select: {
      id: true,
      orderId: true,
      fromUserId: true,
    },
  });

  for (const offer of expiredOffers) {
    await returnExpiredOffer(client, offer, returnedAt);
  }
}

export function sanitizeAvailableOrderOffer(offer, options = {}) {
  return {
    id: offer.id,
    orderId: offer.orderId,
    targetType: offer.targetType,
    targetUserId: offer.targetUserId || '',
    targetTeamId: offer.targetTeamId || '',
    targetTeamName: offer.targetTeamName || '',
    status: offer.status,
    expiresAt: toIsoString(offer.expiresAt),
    createdAt: toIsoString(offer.createdAt),
    updatedAt: toIsoString(offer.updatedAt),
    fromUser: sanitizeBasicUser(offer.fromUser),
    createdByUser: sanitizeBasicUser(offer.createdByUser),
    order: sanitizeOrderRecord(offer.order, options),
  };
}

export async function listAvailableOrderOffers(client, user) {
  await closeExpiredOrderOffers(client);
  const userId = typeof user === 'string' ? user : user?.id;

  const offers = await client.orderOffer.findMany({
    where: {
      status: ORDER_OFFER_STATUS.OPEN,
      targets: {
        some: {
          userId,
          status: ORDER_OFFER_TARGET_STATUS.PENDING,
        },
      },
    },
    include: {
      fromUser: {
        select: BASIC_USER_SELECT,
      },
      createdByUser: {
        select: BASIC_USER_SELECT,
      },
      order: {
        include: ORDER_WITH_OWNER_INCLUDE,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const refreshedOrders = await refreshFlightStatusesForOrders(
    client,
    offers.map(offer => offer.order),
    {
      enabled: hasFlightStatusAccess(user),
    }
  );
  const refreshedOrdersById = new Map(refreshedOrders.map(order => [order.id, order]));

  return offers.map(offer =>
    sanitizeAvailableOrderOffer(
      {
        ...offer,
        order: refreshedOrdersById.get(offer.order.id) || offer.order,
      },
      getOrderSanitizeOptions(user)
    )
  );
}

export async function acceptOrderOffer(client, { actor, orderId, offerId }) {
  await closeExpiredOrderOffers(client);

  const acceptedAt = new Date(nowIso());
  const offer = await client.orderOffer.findFirst({
    where: {
      id: offerId,
      orderId,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    include: {
      order: {
        include: ORDER_WITH_OWNER_INCLUDE,
      },
      targets: {
        where: {
          userId: actor.id,
        },
      },
    },
  });

  if (!offer) {
    throw new Error('Order offer not found');
  }

  const target = offer.targets[0];
  if (!target || target.status !== ORDER_OFFER_TARGET_STATUS.PENDING) {
    throw new Error('Order offer is not available to this driver');
  }

  const claimed = await client.orderOffer.updateMany({
    where: {
      id: offer.id,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    data: {
      status: ORDER_OFFER_STATUS.ACCEPTED,
      acceptedByUserId: actor.id,
      acceptedAt,
      updatedAt: acceptedAt,
    },
  });

  if (claimed.count !== 1) {
    throw new Error('Order offer is no longer available');
  }

  await client.orderOfferTarget.updateMany({
    where: {
      offerId: offer.id,
      userId: actor.id,
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    data: {
      status: ORDER_OFFER_TARGET_STATUS.ACCEPTED,
      respondedAt: acceptedAt,
    },
  });
  await client.orderOfferTarget.updateMany({
    where: {
      offerId: offer.id,
      userId: {
        not: actor.id,
      },
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    data: {
      status: ORDER_OFFER_TARGET_STATUS.CANCELED,
      respondedAt: acceptedAt,
    },
  });

  const updatedOrder = await client.order.update({
    where: {
      id: orderId,
    },
    data: {
      userId: actor.id,
      contractData: buildAcceptedOrderContractData(offer.order.contractData, actor),
      updatedAt: acceptedAt,
    },
    include: ORDER_WITH_OWNER_INCLUDE,
  });

  await createAuditLog(client, {
    action: 'order.offer.accepted',
    actorUserId: actor.id,
    targetUserId: actor.id,
    entityType: 'order',
    entityId: orderId,
    before: {
      userId: offer.order.userId,
      offerId: offer.id,
    },
    after: {
      userId: actor.id,
      offerId: offer.id,
    },
  });

  const refreshedOrder = await refreshFlightStatusForOrder(client, updatedOrder, {
    enabled: hasFlightStatusAccess(actor),
  });

  return sanitizeOrderRecord(refreshedOrder, getOrderSanitizeOptions(actor));
}

export async function skipOrderOffer(client, { actor, orderId, offerId }) {
  await closeExpiredOrderOffers(client);

  const skippedAt = new Date(nowIso());
  const offer = await client.orderOffer.findFirst({
    where: {
      id: offerId,
      orderId,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    include: {
      targets: true,
    },
  });

  if (!offer) {
    throw new Error('Order offer not found');
  }

  const target = offer.targets.find(item => item.userId === actor.id);
  if (!target || target.status !== ORDER_OFFER_TARGET_STATUS.PENDING) {
    throw new Error('Order offer is not available to this driver');
  }

  const touchedOffer = await client.orderOffer.updateMany({
    where: {
      id: offer.id,
      status: ORDER_OFFER_STATUS.OPEN,
    },
    data: {
      updatedAt: skippedAt,
    },
  });

  if (touchedOffer.count !== 1) {
    throw new Error('Order offer is no longer available');
  }

  const skipped = await client.orderOfferTarget.updateMany({
    where: {
      offerId: offer.id,
      userId: actor.id,
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    data: {
      status: ORDER_OFFER_TARGET_STATUS.SKIPPED,
      respondedAt: skippedAt,
    },
  });

  if (skipped.count !== 1) {
    throw new Error('Order offer is no longer available');
  }

  const remainingPending = await client.orderOfferTarget.count({
    where: {
      offerId: offer.id,
      status: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
  });
  const shouldReturn = offer.targetType === 'driver' || remainingPending === 0;

  if (shouldReturn) {
    await client.orderOfferTarget.updateMany({
      where: {
        offerId: offer.id,
        status: ORDER_OFFER_TARGET_STATUS.PENDING,
      },
      data: {
        status: ORDER_OFFER_TARGET_STATUS.CANCELED,
        respondedAt: skippedAt,
      },
    });
    await client.orderOffer.updateMany({
      where: {
        id: offer.id,
        status: ORDER_OFFER_STATUS.OPEN,
      },
      data: {
        status: ORDER_OFFER_STATUS.RETURNED,
        updatedAt: skippedAt,
      },
    });
  }

  await createAuditLog(client, {
    action: shouldReturn ? 'order.offer.returned' : 'order.offer.skipped',
    actorUserId: actor.id,
    targetUserId: shouldReturn ? offer.fromUserId : actor.id,
    entityType: 'order',
    entityId: orderId,
    before: {
      offerId: offer.id,
      targetStatus: ORDER_OFFER_TARGET_STATUS.PENDING,
    },
    after: {
      offerId: offer.id,
      targetStatus: ORDER_OFFER_TARGET_STATUS.SKIPPED,
      offerStatus: shouldReturn ? ORDER_OFFER_STATUS.RETURNED : ORDER_OFFER_STATUS.OPEN,
    },
    meta: {
      reason: shouldReturn ? 'skipped_by_target' : 'skipped_by_driver',
    },
  });

  return {
    ok: true,
    returned: shouldReturn,
  };
}
