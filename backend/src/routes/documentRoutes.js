const crypto = require('node:crypto');
const fs = require('node:fs');
const multer = require('multer');
const express = require('express');
const AppError = require('../errors/AppError');

function createUploadMiddleware(config) {
  const storage = multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(config.storageDir, { recursive: true }, (error) => {
        callback(error, config.storageDir);
      });
    },
    filename(req, file, callback) {
      callback(null, crypto.randomUUID());
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: 1,
    },
  }).single('file');
}

function createDocumentRoutes(controller, config) {
  const router = express.Router();
  const upload = createUploadMiddleware(config);

  router.post('/upload', controller.requireUserId, (req, res, next) => {
    upload(req, res, (error) => {
      if (!error) {
        return controller.upload(req, res).catch(next);
      }

      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'FILE_TOO_LARGE', 'O arquivo excede o limite permitido.'));
      }

      if (error instanceof multer.MulterError && error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError(400, 'MISSING_FILE', "Envie um arquivo no campo 'file'."));
      }

      return next(new AppError(500, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.', { cause: error }));
    });
  });
  router.get('/documents', controller.requireUserId, controller.list);
  router.get('/documents/:id/download', controller.requireUserId, controller.download);

  return router;
}

module.exports = createDocumentRoutes;
