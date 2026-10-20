module.exports = {
  importJWK: async () => ({}),
  exportSPKI: async () => 'test-spki',
  decodeJwt: (token) => {
    try {
      const parts = token.split('.');
      return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  },
  decodeProtectedHeader: (token) => {
    try {
      const parts = token.split('.');
      return JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  },
};
