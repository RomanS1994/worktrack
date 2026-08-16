import { baseApi } from '@shared/app/api/baseApi.js';

export const plansApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getPlans: builder.query({
      query: () => '/plans',
      providesTags: result => {
        const plans = Array.isArray(result?.plans) ? result.plans : [];

        return [
          { type: 'PublicPlans', id: 'LIST' },
          ...plans.map(plan => ({ type: 'PublicPlans', id: plan.id })),
        ];
      },
    }),
  }),
});

export const { useGetPlansQuery } = plansApi;
