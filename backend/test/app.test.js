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
    await run(`http://127.0.0.1:${port}`, storageDir);
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

test('upload válido grava bytes locais e permite download binário', async () => {
  const contents = new Uint8Array([0, 127, 128, 255]);
  await withServer(async (baseUrl, storageDir) => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: uploadForm('binario.dat', contents),
    });
    assert.equal(response.status, 201);
    const document = await response.json();
    assert.equal(document.size, contents.byteLength);
    assert.equal(document.originalName, 'binario.dat');
    assert.deepEqual(await fs.readdir(storageDir), [document.id]);
    assert.deepEqual(await fs.readFile(path.join(storageDir, document.id)), Buffer.from(contents));

    const download = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: { 'X-User-Id': 'usuario-a' },
    });
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /attachment;.*binario\.dat/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.from(contents));
  }, { maxFileSizeBytes: contents.byteLength + 1 });
});

test('upload acima do limite não deixa arquivos nem metadados', async () => {
  await withServer(async (baseUrl, storageDir) => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers: { 'X-User-Id': 'usuario-a' },
      body: uploadForm('grande.txt', '12345'),
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o limite permitido.' },
    });
    assert.deepEqual(await fs.readdir(storageDir), []);
    const list = await fetch(`${baseUrl}/documents`, {
      headers: { 'X-User-Id': 'usuario-a' },
    });
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { documents: [] });
  }, { maxFileSizeBytes: 4 });
});

test('listagem inicialmente vazia retorna todos os documentos do usuário ordenados', async () => {
  await withServer(async (baseUrl) => {
    const headers = { 'X-User-Id': 'usuario-a' };
    const empty = await fetch(`${baseUrl}/documents`, { headers });
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { documents: [] });

    const uploaded = [];
    for (const name of ['primeiro.txt', 'segundo.txt', 'terceiro.txt']) {
      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers,
        body: uploadForm(name, name),
      });
      assert.equal(response.status, 201);
      uploaded.push(await response.json());
    }

    const response = await fetch(`${baseUrl}/documents`, { headers });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      documents: [...uploaded].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt)),
    });
  });
});

test('download de ID inexistente ou arquivo removido retorna o mesmo 404', async () => {
  await withServer(async (baseUrl, storageDir) => {
    const headers = { 'X-User-Id': 'usuario-a' };
    const upload = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      headers,
      body: uploadForm('removido.txt', 'conteudo'),
    });
    assert.equal(upload.status, 201);
    const document = await upload.json();
    await fs.unlink(path.join(storageDir, document.id));

    for (const id of ['00000000-0000-0000-0000-000000000000', document.id]) {
      const response = await fetch(`${baseUrl}/documents/${id}/download`, { headers });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
      });
    }
  });
});

test('todas as rotas documentais rejeitam requisições sem identidade', async () => {
  await withServer(async (baseUrl, storageDir) => {
    for (const [endpoint, options] of [
      ['/upload', { method: 'POST', body: uploadForm('arquivo.txt', 'conteudo') }],
      ['/documents', {}],
      ['/documents/id/download', {}],
    ]) {
      const response = await fetch(`${baseUrl}${endpoint}`, options);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: { code: 'MISSING_USER_ID', message: 'Informe o header X-User-Id.' },
      });
    }
    assert.deepEqual(await fs.readdir(storageDir), []);
  });
});
