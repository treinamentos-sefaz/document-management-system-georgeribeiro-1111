const AppError = require('../errors/AppError');

function createDocumentController(service) {
  function requireUserId(req, res, next) {
    const userId = req.get('X-User-Id');
    if (!userId || !userId.trim()) {
      return next(new AppError(400, 'MISSING_USER_ID', 'Informe o header X-User-Id.'));
    }

    req.userId = userId.trim();
    return next();
  }

  return {
    requireUserId,

    async upload(req, res) {
      if (!req.file) {
        throw new AppError(400, 'MISSING_FILE', "Envie um arquivo no campo 'file'.");
      }

      const document = await service.createDocument(req.file, req.userId);
      res.status(201).json(document);
    },

    async list(req, res) {
      const documents = await service.listDocuments(req.userId);
      res.status(200).json({ documents });
    },

    async download(req, res, next) {
      const document = await service.getDocumentForDownload(req.params.id, req.userId);
      res.download(document.filePath, document.originalName, (error) => {
        if (!error) {
          return;
        }

        if (error.code === 'ENOENT') {
          return next(new AppError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.'));
        }

        return next(new AppError(500, 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.', { cause: error }));
      });
    },
  };
}

module.exports = createDocumentController;
