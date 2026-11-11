const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const appModule = require('../src/app');
const createDocumentController = require('../src/controllers/documentController');
const createDocumentService = require('../src/services/documentService');

async function withServer(run, options = {}) {
  const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const app = appModule.createApp({ storageDir, ...options });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(storageDir, { recursive: true, force: true });
  }
}

function uploadForm(name, contents) {
  const form = new FormData();
  form.append('file', new Blob([contents]), name);
  return form;
}

test('o app backend é exportado', () => {
  assert.equal(typeof appModule, 'function');
});

test('GET /health retorna status ok', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('upload cria documento local e a lista isola documentos por usuário', async () => {
  await withServer(async (baseUrl) => {
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: uploadForm('relatorio.txt', 'conteudo de teste'),
    });

    assert.equal(uploadResponse.status, 201);
    const document = await uploadResponse.json();
    assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.match(document.id, /^[\da-f-]{36}$/i);
    assert.equal(document.originalName, 'relatorio.txt');
    assert.equal(document.owner, 'usuario-a');
    assert.equal(document.size, Buffer.byteLength('conteudo de teste'));

    const ownDocuments = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'usuario-a' },
    });
    assert.deepEqual((await ownDocuments.json()).documents, [document]);

    const otherDocuments = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'usuario-b' },
    });
    assert.deepEqual((await otherDocuments.json()).documents, []);
  });
});

test('download entrega conteúdo e oculta documento de outro usuário', async () => {
  await withServer(async (baseUrl) => {
    const uploadResponse = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: uploadForm('arquivo.txt', 'conteudo privado'),
    });
    const document = await uploadResponse.json();

    const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'usuario-a' },
    });
    assert.equal(downloadResponse.status, 200);
    assert.equal(await downloadResponse.text(), 'conteudo privado');
    assert.match(downloadResponse.headers.get('content-disposition'), /attachment/);

    const hiddenResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'usuario-b' },
    });
    assert.equal(hiddenResponse.status, 404);
    assert.deepEqual(await hiddenResponse.json(), {
      error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
    });
  });
});

test('falhas do repositório são mapeadas para códigos seguros da API', async () => {
  const listService = createDocumentService({
    listByOwner: async () => {
      throw new Error('detalhe interno');
    },
  });
  await assert.rejects(listService.listDocuments('usuario-a'), {
    code: 'LIST_FAILED',
    statusCode: 500,
  });

  const downloadService = createDocumentService({
    findByIdAndOwner: async () => {
      throw new Error('detalhe interno');
    },
  });
  await assert.rejects(downloadService.getDocumentForDownload('id', 'usuario-a'), {
    code: 'DOWNLOAD_FAILED',
    statusCode: 500,
  });

  const fileService = createDocumentService({
    findByIdAndOwner: async () => ({ fileName: 'arquivo-local' }),
    fileExists: async () => {
      throw new Error('detalhe interno');
    },
  });
  await assert.rejects(fileService.getDocumentForDownload('id', 'usuario-a'), {
    code: 'DOWNLOAD_FAILED',
    statusCode: 500,
  });

  const controller = createDocumentController({
    getDocumentForDownload: async () => ({ filePath: '/tmp/arquivo', originalName: 'arquivo.txt' }),
  });
  let downloadError;
  await controller.download(
    { params: { id: 'id' }, userId: 'usuario-a' },
    { download: (filePath, fileName, callback) => callback(new Error('falha de leitura')) },
    (error) => {
      downloadError = error;
    },
  );
  assert.equal(downloadError.code, 'DOWNLOAD_FAILED');
  assert.equal(downloadError.statusCode, 500);
});

test('rotas documentais validam usuário e arquivo e aplicam limite de upload', async () => {
  await withServer(async (baseUrl) => {
    const missingUser = await fetch(`${baseUrl}/documents`);
    assert.equal(missingUser.status, 400);
    assert.equal((await missingUser.json()).error.code, 'MISSING_USER_ID');

    const missingFile = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: new FormData(),
    });
    assert.equal(missingFile.status, 400);
    assert.equal((await missingFile.json()).error.code, 'MISSING_FILE');
  }, { maxFileSizeBytes: 4 });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: uploadForm('grande.txt', 'maior que quatro bytes'),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'FILE_TOO_LARGE');
  }, { maxFileSizeBytes: 4 });
});
