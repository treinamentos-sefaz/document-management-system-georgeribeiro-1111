const AppError = require('../errors/AppError');

function toDocument(file, owner) {
  return {
    id: file.filename,
    fileName: file.filename,
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    mimeType: file.mimetype,
  };
}

async function withRepositoryError(operation, code, message) {
  try {
    return await operation();
  } catch (error) {
    throw new AppError(500, code, message, { cause: error });
  }
}

function createDocumentService(repository) {
  async function saveDocument(document) {
    try {
      return await repository.save(document);
    } catch (error) {
      try {
        await repository.removeStoredFile(document.fileName);
      } catch (cleanupError) {
        console.error('Falha ao remover arquivo após erro ao registrar metadados.', cleanupError);
      }

      throw error;
    }
  }

  return {
    async createDocument(file, owner) {
      const document = toDocument(file, owner);
      return withRepositoryError(
        () => saveDocument(document),
        'UPLOAD_FAILED',
        'Não foi possível enviar o documento.',
      );
    },

    async listDocuments(owner) {
      return withRepositoryError(
        () => repository.listByOwner(owner),
        'LIST_FAILED',
        'Não foi possível listar os documentos.',
      );
    },

    async getDocumentForDownload(id, owner) {
      const document = await withRepositoryError(
        async () => {
          const storedDocument = await repository.findByIdAndOwner(id, owner);
          if (!storedDocument || !(await repository.fileExists(storedDocument.fileName))) {
            return null;
          }

          return storedDocument;
        },
        'DOWNLOAD_FAILED',
        'Não foi possível baixar o documento.',
      );

      if (!document) {
        throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
      }

      return {
        filePath: repository.getFilePath(document.fileName),
        originalName: document.originalName,
      };
    },
  };
}

module.exports = createDocumentService;
