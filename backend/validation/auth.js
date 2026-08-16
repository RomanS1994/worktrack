import { normalizeEmail, normalizeText } from './common.js';

function validatePassword(password) {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
}

export function validateRegistrationInput(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const name = normalizeText(body.name);

  if (!name) {
    throw new Error('Name is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  validatePassword(password);

  return {
    email,
    name,
    password,
  };
}

export function validateCompanyRegistrationInput(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const firstName = normalizeText(body.firstName);
  const lastName = normalizeText(body.lastName);
  const companyName = normalizeText(body.companyName);
  const name = normalizeText(body.name) || [firstName, lastName].filter(Boolean).join(' ');

  if (!firstName) {
    throw new Error('First name is required');
  }

  if (!lastName) {
    throw new Error('Last name is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  validatePassword(password);

  if (!companyName) {
    throw new Error('Company name is required');
  }

  return {
    email,
    password,
    firstName,
    lastName,
    name,
    companyName,
  };
}

export function validateLoginInput(body = {}) {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');

  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  return {
    email,
    password,
  };
}
