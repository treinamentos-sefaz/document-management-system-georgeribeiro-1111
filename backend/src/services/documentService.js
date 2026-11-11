const AppError = require('../errors/AppError');

function createDocumentService(repository) {
  return {
    async createDocument(file, owner) {
      const document = {
        id: file.filename,
        fileName: file.filename,
        originalName: file.originalname,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        owner,
        mimeType: file.mimetype,
      };

      try {
        return await repository.save(document);
      } catch (error) {
        try {
          await repository.removeStoredFile(document.fileName);
        } catch (cleanupError) {
          console.error('Falha ao remover arquivo após erro ao registrar metadados.', cleanupError);
        }

        throw new AppError(500, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.', { cause: error });
      }
    },

    async listDocuments(owner) {
      return repository.listByOwner(owner);
    },

    async getDocumentForDownload(id, owner) {
      const document = await repository.findByIdAndOwner(id, owner);
      if (!document || !(await repository.fileExists(document.fileName))) {
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
