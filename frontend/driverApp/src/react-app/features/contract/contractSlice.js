import { createSlice } from '@reduxjs/toolkit';

function createEmptyBusinessParty() {
  return {
    id: '',
    name: '',
    address: '',
    ico: '',
    dic: '',
  };
}

function createEmptyCustomer() {
  return {
    name: '',
    email: '',
    birthDate: '',
    address: '',
  };
}

function mergeContractDefaults(contract) {
  const defaults = createDefaultContractState();
  const nextContract = contract && typeof contract === 'object' ? contract : {};
  const nextCustomer =
    nextContract.customer && typeof nextContract.customer === 'object'
      ? nextContract.customer
      : {};
  const nextProvider =
    nextContract.provider && typeof nextContract.provider === 'object'
      ? nextContract.provider
      : {};
  const nextDriver =
    nextContract.driver && typeof nextContract.driver === 'object'
      ? nextContract.driver
      : {};

  return {
    ...defaults,
    ...nextContract,
    driver: {
      ...defaults.driver,
      ...nextDriver,
    },
    provider: {
      ...defaults.provider,
      ...nextProvider,
    },
    customer: {
      ...defaults.customer,
      ...nextCustomer,
    },
  };
}

export function createDefaultContractState() {
  return {
    orderNumber: '',
    today: '',
    documentType: 'confirmation',
    flightNumber: '',
    driver: {
      ...createEmptyBusinessParty(),
      spz: '',
    },
    provider: createEmptyBusinessParty(),
    customer: createEmptyCustomer(),
    passengers: '',
    trip: {
      from: { address: '' },
      to: { address: '' },
      time: '',
      paymentMethod: '',
      driverComment: '',
      luggageUnits: 0,
      childSeats: {
        enabled: false,
        infant: 0,
        child: 0,
        booster: 0,
      },
    },
    totalPrice: '',
  };
}

const contractSlice = createSlice({
  name: 'contract',
  initialState: createDefaultContractState(),
  reducers: {
    setOrderNumber(state, action) {
      state.orderNumber = action.payload;
    },
    setToday(state, action) {
      state.today = action.payload;
    },
    setDocumentType(state, action) {
      state.documentType = action.payload;
    },
    setFlightNumber(state, action) {
      state.flightNumber = action.payload;
    },
    updateDriverField(state, action) {
      const field = action.payload.key || action.payload.field;
      state.driver[field] = action.payload.value;
    },
    updateProviderField(state, action) {
      const field = action.payload.key || action.payload.field;
      state.provider[field] = action.payload.value;
    },
    setProvider(state, action) {
      state.provider = {
        ...createEmptyBusinessParty(),
        ...(action.payload || {}),
      };
    },
    updateCustomerField(state, action) {
      const field = action.payload.key || action.payload.field;
      state.customer[field] = action.payload.value;
    },
    updateTripField(state, action) {
      const field = action.payload.key || action.payload.field;
      const value = action.payload.value;

      if (field === 'from' || field === 'to') {
        state.trip[field] =
          value && typeof value === 'object' ? value : { address: value || '' };
        return;
      }

      state.trip[field] = value;
    },
    setPassengers(state, action) {
      state.passengers = action.payload;
    },
    setTotalPrice(state, action) {
      state.totalPrice = action.payload;
    },
    syncBusinessProfile(state, action) {
      const driver = action.payload?.driver || {};
      const provider = action.payload?.provider || {};

      state.driver = {
        ...state.driver,
        ...driver,
      };
      state.provider = {
        ...state.provider,
        ...provider,
      };
    },
    resetContract(state) {
      return {
        ...createDefaultContractState(),
        documentType: state.documentType || 'confirmation',
        driver: {
          ...createEmptyBusinessParty(),
          spz: '',
          ...state.driver,
        },
        provider: {
          ...createEmptyBusinessParty(),
          ...state.provider,
        },
      };
    },
    replaceContract(_state, action) {
      return mergeContractDefaults(action.payload);
    },
  },
});

export const {
  setOrderNumber,
  setToday,
  setDocumentType,
  setFlightNumber,
  updateDriverField,
  updateProviderField,
  setProvider,
  updateCustomerField,
  updateTripField,
  setPassengers,
  setTotalPrice,
  syncBusinessProfile,
  resetContract,
  replaceContract,
} = contractSlice.actions;

export const selectContract = state => state.contract;
export const selectDriver = state => state.contract.driver;
export const selectProvider = state => state.contract.provider;
export const selectCustomer = state => state.contract.customer;
export const selectTrip = state => state.contract.trip;

export default contractSlice.reducer;
