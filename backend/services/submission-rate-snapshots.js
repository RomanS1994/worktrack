export async function freezeSubmissionHourlyRateSnapshots(client, membership, submission) {
  const hourlyRateCzk = membership?.hourlyRateCzk == null ? null : String(membership.hourlyRateCzk);
  if (hourlyRateCzk == null || !submission?.id) {
    return { count: 0 };
  }

  return client.workEntry.updateMany({
    where: {
      companyId: membership.companyId,
      employeeMembershipId: membership.id,
      weeklySubmissionId: submission.id,
      hourlyRateCzk: null,
    },
    data: { hourlyRateCzk },
  });
}
