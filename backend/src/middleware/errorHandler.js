const AppError = require('../errors/AppError');

function createErrorHandler() {
  return (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const knownError = error instanceof AppError;
    const statusCode = knownError ? error.statusCode : 500;
    const code = knownError ? error.code : 'INTERNAL_SERVER_ERROR';
    const message = knownError ? error.message : 'Ocorreu um erro interno.';

    if (!knownError) {
      console.error('Erro inesperado ao processar requisição.', error);
    }

    return res.status(statusCode).json({
      error: { code, message },
    });
  };
}

module.exports = createErrorHandler;
