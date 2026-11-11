const { test } = require('node:test');
const assert = require('node:assert/strict');
const createDocumentService = require('../src/services/documentService');
const AppError = require('../src/errors/AppError');

const file = {
  filename: 'arquivo-local',
  originalname: 'relatorio.txt',
  size: 12,
  mimetype: 'text/plain',
};

test('criação monta metadados e retorna o resultado do repositório', async () => {
  const publicDocument = { id: file.filename };
  let savedDocument;
  const service = createDocumentService({
    save: async (document) => {
      savedDocument = document;
      return publicDocument;
    },
    removeStoredFile: async () => assert.fail('Não deve remover um arquivo salvo com sucesso.'),
  });
  const before = Date.now();

  assert.equal(await service.createDocument(file, 'usuario-a'), publicDocument);
  const { uploadedAt, ...metadata } = savedDocument;
  assert.deepEqual(metadata, {
    id: file.filename,
    fileName: file.filename,
    originalName: file.originalname,
    size: file.size,
    owner: 'usuario-a',
    mimeType: file.mimetype,
  });
  assert.equal(new Date(uploadedAt).toISOString(), uploadedAt);
  assert.ok(Date.parse(uploadedAt) >= before && Date.parse(uploadedAt) <= Date.now());
});

test('falha ao salvar remove o arquivo e preserva a causa original', async () => {
  const cause = new Error('falha de persistência');
  const calls = [];
  const service = createDocumentService({
    save: async () => {
      calls.push('save');
      throw cause;
    },
    removeStoredFile: async (fileName) => {
      calls.push(fileName);
    },
  });

  await assert.rejects(service.createDocument(file, 'usuario-a'), {
    name: 'AppError',
    statusCode: 500,
    code: 'UPLOAD_FAILED',
    message: 'Não foi possível enviar o documento.',
    cause,
  });
  assert.deepEqual(calls, ['save', file.filename]);
});

test('falha na limpeza é registrada sem substituir a falha de persistência', async (t) => {
  const cause = new Error('falha de persistência');
  const cleanupError = new Error('falha na limpeza');
  const logger = t.mock.method(console, 'error', () => {});
  const service = createDocumentService({
    save: async () => {
      throw cause;
    },
    removeStoredFile: async () => {
      throw cleanupError;
    },
  });

  await assert.rejects(service.createDocument(file, 'usuario-a'), {
    code: 'UPLOAD_FAILED',
    statusCode: 500,
    cause,
  });
  assert.equal(logger.mock.callCount(), 1);
  assert.deepEqual(logger.mock.calls[0].arguments, [
    'Falha ao remover arquivo após erro ao registrar metadados.',
    cleanupError,
  ]);
});

test('listagem repassa o owner e preserva o resultado do repositório', async () => {
  const documents = [{ id: 'documento' }];
  const service = createDocumentService({
    listByOwner: async (owner) => {
      assert.equal(owner, 'usuario-a');
      return documents;
    },
  });

  assert.equal(await service.listDocuments('usuario-a'), documents);
});

test('download repassa id e owner e retorna apenas caminho e nome original', async () => {
  const service = createDocumentService({
    findByIdAndOwner: async (id, owner) => {
      assert.equal(id, 'documento');
      assert.equal(owner, 'usuario-a');
      return { fileName: file.filename, originalName: file.originalname };
    },
    fileExists: async (fileName) => {
      assert.equal(fileName, file.filename);
      return true;
    },
    getFilePath: (fileName) => {
      assert.equal(fileName, file.filename);
      return '/storage/arquivo-local';
    },
  });

  assert.deepEqual(await service.getDocumentForDownload('documento', 'usuario-a'), {
    filePath: '/storage/arquivo-local',
    originalName: file.originalname,
  });
});

test('documento ausente e arquivo removido mantêm o mesmo erro 404', async (t) => {
  for (const document of [null, { fileName: file.filename }]) {
    await t.test(document ? 'arquivo removido' : 'documento ausente', async () => {
      const service = createDocumentService({
        findByIdAndOwner: async () => document,
        fileExists: async () => {
          assert.ok(document, 'Não deve consultar o filesystem sem metadados.');
          return false;
        },
        getFilePath: () => assert.fail('Não deve resolver caminho sem arquivo disponível.'),
      });

      await assert.rejects(service.getDocumentForDownload('documento', 'usuario-a'), {
        name: 'AppError',
        code: 'DOCUMENT_NOT_FOUND',
        statusCode: 404,
        message: 'Documento não encontrado.',
      });
    });
  }
});

test('falhas de consulta mantêm códigos, mensagens e causas por operação', async (t) => {
  const cases = [
    ['listByOwner', 'listDocuments', 'LIST_FAILED', 'Não foi possível listar os documentos.'],
    ['findByIdAndOwner', 'getDocumentForDownload', 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.'],
    ['fileExists', 'getDocumentForDownload', 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.'],
  ];

  for (const [repositoryMethod, serviceMethod, code, message] of cases) {
    await t.test(repositoryMethod, async () => {
      const cause = new Error('detalhe interno');
      const service = createDocumentService({
        findByIdAndOwner: async () => ({ fileName: file.filename }),
        [repositoryMethod]: async () => {
          throw cause;
        },
      });

      await assert.rejects(service[serviceMethod]('documento', 'usuario-a'), (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 500);
        assert.equal(error.code, code);
        assert.equal(error.message, message);
        assert.equal(error.cause, cause);
        return true;
      });
    });
  }
});
