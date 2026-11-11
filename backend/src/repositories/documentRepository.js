const fs = require('node:fs/promises');
const path = require('node:path');

function toPublicDocument(document) {
  const { id, originalName, size, uploadedAt, owner } = document;
  return { id, originalName, size, uploadedAt, owner };
}

function createDocumentRepository(storageDir) {
  const documents = new Map();

  return {
    async save(document) {
      documents.set(document.id, { ...document });
      return toPublicDocument(document);
    },

    async listByOwner(owner) {
      return [...documents.values()]
        .filter((document) => document.owner === owner)
        .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
        .map(toPublicDocument);
    },

    async findByIdAndOwner(id, owner) {
      const document = documents.get(id);
      if (!document || document.owner !== owner) {
        return null;
      }

      return { ...document };
    },

    getFilePath(fileName) {
      return path.join(storageDir, fileName);
    },

    async fileExists(fileName) {
      try {
        const stats = await fs.stat(this.getFilePath(fileName));
        return stats.isFile();
      } catch (error) {
        if (error.code === 'ENOENT') {
          return false;
        }

        throw error;
      }
    },

    async removeStoredFile(fileName) {
      await fs.unlink(this.getFilePath(fileName));
    },
  };
}

module.exports = createDocumentRepository;
