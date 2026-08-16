export function isEmpty(value) {
  return String(value || '').trim() === '';
}

export function validateContract(contract) {
  const errors = {
    customerName: '',
    customerContact: '',
    passengers: '',
    fromAddress: '',
    toAddress: '',
    tripDate: '',
    paymentMethod: '',
    totalPrice: '',
  };

  if (isEmpty(contract?.customer?.name)) {
    errors.customerName = 'Customer name is required.';
  }

  const customerContact = contract?.customer?.email || contract?.customer?.phone || '';
  if (isEmpty(customerContact)) {
    errors.customerContact = 'Customer contact is required.';
  }

  if (isEmpty(contract?.passengers)) {
    errors.passengers = 'Passengers count is required.';
  }

  if (isEmpty(contract?.trip?.from?.address)) {
    errors.fromAddress = 'Trip from address is required.';
  }

  if (isEmpty(contract?.trip?.to?.address)) {
    errors.toAddress = 'Trip to address is required.';
  }

  if (isEmpty(contract?.trip?.time)) {
    errors.tripDate = 'Pickup date and time is required.';
  }

  if (isEmpty(contract?.trip?.paymentMethod)) {
    errors.paymentMethod = 'Payment method is required.';
  }

  if (isEmpty(contract?.totalPrice)) {
    errors.totalPrice = 'Total price is required.';
  }

  const isValid =
    errors.customerName === '' &&
    errors.customerContact === '' &&
    errors.passengers === '' &&
    errors.fromAddress === '' &&
    errors.toAddress === '' &&
    errors.tripDate === '' &&
    errors.paymentMethod === '' &&
    errors.totalPrice === '';

  return {
    isValid,
    errors,
  };
}
