const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function parseMaxFileSize(value) {
  if (value === undefined || value === '') {
    return DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  return parsed;
}

function createConfig(options = {}) {
  const storageDir = options.storageDir || process.env.STORAGE_DIR || path.join(BACKEND_ROOT, 'storage');
  const maxFileSizeBytes = options.maxFileSizeBytes
    ?? parseMaxFileSize(process.env.MAX_FILE_SIZE_BYTES);

  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
    throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
  }

  return {
    storageDir: path.isAbsolute(storageDir) ? storageDir : path.resolve(BACKEND_ROOT, storageDir),
    maxFileSizeBytes,
  };
}

module.exports = createConfig;
