import { ratesForDate } from './membership-rates.js';
export async function freezeSubmissionHourlyRateSnapshots(client, membership, submission) {
  const latest = client.companyMembership?.findFirst ? await client.companyMembership.findFirst({ where:{ id:membership.id, companyId:membership.companyId } }) : membership;
  if (Array.isArray(latest?.rateHistory) && latest.rateHistory.length && submission?.id) {
    const entries = await client.workEntry.findMany({ where:{ companyId:membership.companyId, employeeMembershipId:membership.id, weeklySubmissionId:submission.id, OR:[{hourlyRateCzk:null},{customerRateCzk:null}] } });
    let count = 0;
    for (const entry of entries) {
      await client.workEntry.update({ where:{id:entry.id}, data:ratesForDate(latest, entry.workDate) });
      count++;
    }
    return { count };
  }
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
