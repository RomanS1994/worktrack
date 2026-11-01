import test from 'node:test';
import assert from 'node:assert/strict';
import { changedRateHistory, ratesForDate, rateDate } from '../services/membership-rates.js';
import { updateEmployeeMembership } from '../services/manager-workflow.js';

test('dated rates preserve the baseline and stop at the next scheduled change', () => {
  const original = { hourlyRateCzk:'200.00', customerRateCzk:'300.00' };
  const future = changedRateHistory(original, '2026-12-01', {hourlyRateCzk:'250.00',customerRateCzk:'350.00'});
  const history = changedRateHistory({...original,rateHistory:future}, '2026-10-15', {hourlyRateCzk:'230.00',customerRateCzk:'320.00'});
  const membership = {...original,rateHistory:history};
  assert.equal(ratesForDate(membership,'2026-10-14').hourlyRateCzk,'200.00');
  assert.equal(ratesForDate(membership,'2026-10-15').hourlyRateCzk,'230.00');
  assert.equal(ratesForDate(membership,'2026-11-30').customerRateCzk,'320.00');
  assert.equal(ratesForDate(membership,'2026-12-01').hourlyRateCzk,'250.00');
  const corrected=changedRateHistory(membership,'2026-10-15',{hourlyRateCzk:'240.00',customerRateCzk:'330.00'});
  assert.equal(corrected.length,3);
  assert.equal(ratesForDate({...membership,rateHistory:corrected},'2026-11-01').hourlyRateCzk,'240.00');
});

test('invalid dates cannot recalculate records', () => {
  for (const date of ['2026-02-30','2026-13-01','oops','']) assert.throws(()=>rateDate(date),/Invalid rate effective date/);
});

test('backdated changes atomically update both hour sources within the bounded interval', async () => {
  const calls=[];
  const existing={id:'employee',companyId:'company',userId:'user',role:'EMPLOYEE',status:'ACTIVE',hourlyRateCzk:'200.00',customerRateCzk:'300.00',user:{},rateHistory:[{effectiveFrom:'0001-01-01',hourlyRateCzk:'200.00',customerRateCzk:'300.00',baseline:true},{effectiveFrom:'2026-12-01',hourlyRateCzk:'250.00',customerRateCzk:'350.00'}]};
  const tx={
    $queryRaw:async()=>calls.push('lock'),
    companyMembership:{findFirst:async()=>existing,update:async({data})=>({...existing,...data})},
    workEntry:{updateMany:async args=>calls.push(['worker',args])},
    managerTimesheetEntry:{updateMany:async args=>calls.push(['manager',args])},
    auditLog:{create:async args=>calls.push(['audit',args])},
  };
  const client={$transaction:async fn=>{calls.push('transaction');return fn(tx);}};
  await updateEmployeeMembership(client,{activeMembership:{id:'manager',companyId:'company',userId:'boss',role:'MANAGER',status:'ACTIVE'}},'employee',{hourlyRateCzk:'230',customerRateCzk:'320',effectiveFrom:'2026-10-15'});
  assert.deepEqual(calls.slice(0,2),['transaction','lock']);
  for(const kind of ['worker','manager']) {
    const args=calls.find(item=>item[0]===kind)[1];
    assert.equal(args.where.companyId,'company');
    assert.equal(args.where.workDate.gte.toISOString(),'2026-10-15T00:00:00.000Z');
    assert.equal(args.where.workDate.lt.toISOString(),'2026-12-01T00:00:00.000Z');
    assert.equal(args.data.hourlyRateCzk,'230.00');
  }
});
