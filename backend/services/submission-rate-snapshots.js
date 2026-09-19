export async function freezeSubmissionHourlyRateSnapshots(client, membership, submission) {
  const hourlyRateCzk = membership?.hourlyRateCzk == null ? null : String(membership.hourlyRateCzk);
  const customerRateCzk = membership?.customerRateCzk == null
    ? hourlyRateCzk
    : String(membership.customerRateCzk);
  if (hourlyRateCzk == null || !submission?.id) {
    return { count: 0 };
  }

  return client.workEntry.updateMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      weeklySubmissionId: submission.id,
      OR: [
        { hourlyRateCzk: null },
        { customerRateCzk: null },
      ],
    },
    data: { hourlyRateCzk, customerRateCzk },
  });
}
