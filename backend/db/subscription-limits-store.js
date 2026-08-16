export async function syncSubscriptionPlanLimits(prisma) {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      quotaOverride: null,
    },
    select: {
      id: true,
      planId: true,
      monthlyGenerationLimit: true,
      plan: {
        select: {
          monthlyGenerationLimit: true,
        },
      },
    },
  });

  const mismatches = subscriptions.filter(
    subscription =>
      subscription.plan &&
      subscription.monthlyGenerationLimit !== subscription.plan.monthlyGenerationLimit
  );

  if (!mismatches.length) {
    return 0;
  }

  await prisma.$transaction(
    mismatches.map(subscription =>
      prisma.subscription.update({
        where: {
          id: subscription.id,
        },
        data: {
          monthlyGenerationLimit: subscription.plan.monthlyGenerationLimit,
        },
      })
    )
  );

  return mismatches.length;
}
