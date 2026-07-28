// Base API configurations and utilities for InterviewIQ

export const API_BASE_URL = 'http://localhost:8000/api'; // Reserved for future FastAPI integration

/**
 * Simulates network latency.
 * @param {number} ms - The millisecond delay duration.
 * @returns {Promise<void>}
 */
export const simulateDelay = (ms = 1000) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Wrapper for fetch that automatically includes HttpOnly cookies.
 * @param {string} endpoint - The API endpoint relative path.
 * @param {RequestInit} options - Fetch options.
 */
export const fetchWithAuth = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add CSRF token for non-GET requests
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf_token='));
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1].trim();
      defaultOptions.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const finalOptions = {
    ...options,
    ...defaultOptions,
  };

  const response = await fetch(url, finalOptions);
  return response;
};
