import { baseApi } from '@shared/app/api/baseApi.js';

export const contractApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    generateContractPdf: builder.mutation({
      query: ({ contractData, orderId, documentType }) => ({
        url: '/contracts/get-pdf',
        method: 'POST',
        body: {
          contractData,
          orderId,
          documentType,
        },
        responseHandler: response => response.blob(),
      }),
    }),
  }),
});

export const { useGenerateContractPdfMutation } = contractApi;
