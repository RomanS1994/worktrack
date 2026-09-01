import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCompanySettings,
  updateCompanySettings,
} from '../services/company-settings.js';

function managerContext() {
  return {
    activeMembership: {
      id: 'manager-1',
      userId: 'manager-user-1',
      companyId: 'company-1',
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  };
}

test('company settings are scoped to the active manager company', async () => {
  const client = {
    company: {
      findUnique: async query => {
        assert.deepEqual(query.where, { id: 'company-1' });
        return { id: 'company-1', name: 'Acme', slug: 'acme' };
      },
    },
  };

  const result = await getCompanySettings(client, managerContext());
  assert.equal(result.company.id, 'company-1');
  assert.equal(result.company.name, 'Acme');
});

test('company settings update cannot target another company id from payload', async () => {
  let updateWhere = null;
  const client = {
    company: {
      update: async args => {
        updateWhere = args.where;
        return { id: 'company-1', name: args.data.name, slug: 'acme' };
      },
    },
    auditLog: {
      create: async () => ({}),
    },
  };

  const result = await updateCompanySettings(client, managerContext(), {
    id: 'company-other',
    name: 'Updated',
  });

  assert.deepEqual(updateWhere, { id: 'company-1' });
  assert.equal(result.company.name, 'Updated');
});

test('employee cannot update company settings', async () => {
  const context = managerContext();
  context.activeMembership.role = 'EMPLOYEE';

  await assert.rejects(
    () => updateCompanySettings({}, context, { name: 'Nope' }),
    /Manager access is required/,
  );
});
