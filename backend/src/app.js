const express = require('express');
const createConfig = require('./config');
const createDocumentRepository = require('./repositories/documentRepository');
const createDocumentService = require('./services/documentService');
const createDocumentController = require('./controllers/documentController');
const createDocumentRoutes = require('./routes/documentRoutes');
const createErrorHandler = require('./middleware/errorHandler');

function createApp(options = {}) {
  const config = createConfig(options);
  const repository = createDocumentRepository(config.storageDir);
  const service = createDocumentService(repository);
  const controller = createDocumentController(service);
  const app = express();

  app.use(express.json());
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use(createDocumentRoutes(controller, config));
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Recurso não encontrado.',
      },
    });
  });
  app.use(createErrorHandler());

  return app;
}

const app = createApp();

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
