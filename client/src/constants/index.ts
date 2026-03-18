/**
 * Application constants
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
};

export const MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  ERROR: 'Something went wrong',
  LOADING: 'Loading...',
};
