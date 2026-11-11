# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web simples para que usuários identifiquem, enviem, listem e baixem seus documentos, mantendo os arquivos no filesystem local da aplicação e os metadados em memória.

## 2. Estado atual e premissas

O repositório contém um seed: o backend exporta uma aplicação Express com `GET /health`; as rotas de documentos e a experiência funcional do frontend ainda são etapas futuras. Esta especificação define o comportamento esperado do MVP, não afirma que esses recursos já estejam implementados.

- Backend: Node.js, Express e CommonJS; testes com `node:test`.
- Frontend: React e Vite; chamadas HTTP por `fetch` através do prefixo `/api`.
- Identidade do MVP: o cliente envia `X-User-Id`. Esse valor serve apenas para separar logicamente documentos em ambiente local. Não autentica o solicitante e não deve ser considerado uma proteção de segurança.
- Cada requisição documental atua somente sobre documentos cujo `owner` corresponde ao `X-User-Id` recebido.
- A aplicação não valida tipo MIME por allowlist no MVP. O MIME recebido é apenas metadado indicativo e não deve ser tratado como prova do conteúdo do arquivo.

## 3. Escopo

### Dentro do escopo

- Enviar um arquivo por requisição.
- Listar os metadados dos documentos do usuário informado.
- Baixar um documento do usuário informado pelo seu identificador.
- Persistir o conteúdo do arquivo localmente com Multer e `diskStorage`.
- Manter os metadados em memória durante a vida do processo.
- Exibir no frontend o fluxo de upload, a lista e uma ação de download, com estados de carregamento e erro.

### Fora do escopo

- Autenticação, autorização baseada em credenciais ou gerenciamento de contas. `X-User-Id` não substitui esses mecanismos.
- Banco de dados, armazenamento em nuvem, serviços externos ou upload de terceiros.
- Exclusão de documentos, versionamento, compartilhamento, busca, paginação ou edição de metadados.
- Garantia de persistência dos metadados após reinício do processo.
- Allowlist ou validação profunda do formato real do arquivo.

## 4. Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | A aplicação deve aceitar um arquivo no campo multipart `file` e associá-lo ao usuário indicado em `X-User-Id`. |
| RF-02 | A aplicação deve gerar um identificador único e um nome de armazenamento não controlado pelo cliente. |
| RF-03 | Após o upload bem-sucedido, a aplicação deve retornar os metadados públicos do documento criado. |
| RF-04 | A aplicação deve listar todos os documentos do usuário indicado, do upload mais recente ao mais antigo. |
| RF-05 | A aplicação deve permitir baixar um documento pelo identificador somente quando ele pertencer ao usuário indicado. |
| RF-06 | A aplicação deve responder `404` tanto para um identificador inexistente quanto para um documento de outro usuário, sem revelar qual dos casos ocorreu. |
| RF-07 | A aplicação deve disponibilizar `GET /health` para indicar que o processo HTTP está respondendo. |
| RF-08 | O frontend deve permitir selecionar e enviar um arquivo, apresentar os documentos listados e solicitar seu download através da API. |
| RF-09 | O frontend deve apresentar erros recebidos da API de forma compreensível e manter a interface utilizável após uma falha de upload, listagem ou download. |

## 5. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem ser gravados exclusivamente no filesystem local com Multer `diskStorage`; o diretório padrão é `backend/storage`. |
| RNF-02 | O diretório de armazenamento deve poder ser sobrescrito por `STORAGE_DIR`; caminhos fornecidos pelo cliente nunca devem definir o destino. |
| RNF-03 | Os metadados devem ser mantidos em memória. Eles são voláteis e se perdem quando o processo reinicia. |
| RNF-04 | O limite padrão de upload deve ser 10 MiB (`10 * 1024 * 1024` bytes) e configurável por `MAX_FILE_SIZE_BYTES`. |
| RNF-05 | A porta HTTP deve ser configurável por `PORT`, com padrão `3000`. |
| RNF-06 | A API deve responder erros no envelope definido nesta especificação e não deve expor stack traces, caminhos locais ou detalhes internos ao cliente. |
| RNF-07 | As responsabilidades devem seguir Clean Architecture simples: `routes -> controllers -> services -> repositories`. |
| RNF-08 | A interface deve consumir a API com `fetch` usando `/api`; o proxy de desenvolvimento do Vite remove esse prefixo antes de encaminhar ao backend. |
| RNF-09 | O backend deve tratar erros de validação, gravação e leitura nos limites apropriados e ter testes automatizados para os contratos essenciais. |

## 6. Modelo de dados

### 6.1 Metadados públicos do documento

Este objeto é retornado no upload e na listagem. Caminhos e nomes internos de armazenamento não fazem parte da API.

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | Sim | UUID gerado pelo servidor e usado nas rotas de documento. |
| `originalName` | string | Sim | Nome original fornecido pelo cliente, tratado como dado não confiável e utilizado para exibição/download. |
| `size` | number | Sim | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Sim | Instante do upload em ISO 8601 UTC. |
| `owner` | string | Sim | Valor de `X-User-Id` associado ao documento. É uma identidade lógica do MVP, não uma identidade autenticada. |

Exemplo:

```json
{
  "id": "b4378f40-99ce-4bc2-9aad-93ad87e15f34",
  "originalName": "relatorio.pdf",
  "size": 34812,
  "uploadedAt": "2026-11-11T14:30:00.000Z",
  "owner": "usuario-local-1"
}
```

### 6.2 Dados internos de persistência

O repositório de metadados mantém uma entrada em memória por `id`, contendo os campos públicos e uma referência interna ao arquivo. A persistência local deve usar um nome gerado pelo servidor, por exemplo o UUID do documento, sem usar o nome ou caminho fornecido pelo cliente. A referência de armazenamento pode ser o nome gerado ou um caminho resolvido dentro de `STORAGE_DIR`; ela nunca deve ser retornada pela API.

O campo `owner` é obtido exclusivamente do header, não de um campo multipart. O registro em memória e o arquivo são criados durante o mesmo fluxo de upload; se o registro de metadados falhar após a gravação, o serviço deve tentar remover o arquivo recém-gravado e registrar a falha sem expor o caminho ao cliente.

## 7. Contratos de API

As rotas abaixo são os caminhos recebidos pelo backend. No frontend de desenvolvimento, chamadas como `/api/documents` são encaminhadas pelo Vite para `/documents` no backend.

### 7.1 Envelope de erro

Toda resposta de erro da API deve usar JSON neste formato:

```json
{
  "error": {
    "code": "MISSING_FILE",
    "message": "Envie um arquivo no campo 'file'."
  }
}
```

`code` é estável para consumo pelo frontend; `message` é uma mensagem segura para apresentação. Stack trace, conteúdo do filesystem e detalhes internos não devem ser incluídos.

### 7.2 `POST /upload`

Envia um arquivo e cria os metadados do documento.

- Headers obrigatórios: `X-User-Id` não vazio; `Content-Type: multipart/form-data` com boundary definido pelo cliente HTTP.
- Corpo: um único arquivo no campo multipart `file`. Campos de formulário adicionais não são necessários e não definem `owner`, ID ou destino do arquivo.
- Limite: `MAX_FILE_SIZE_BYTES`, padrão 10 MiB. Não há allowlist MIME no MVP.
- Sucesso: `201 Created`, `Content-Type: application/json`, corpo igual aos metadados públicos do novo documento.
- Erros:

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `MISSING_USER_ID` | Header ausente ou vazio. |
| `400` | `MISSING_FILE` | Campo `file` ausente ou sem arquivo. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede `MAX_FILE_SIZE_BYTES`. |
| `500` | `UPLOAD_FAILED` | Falha inesperada ao gravar arquivo ou registrar metadados. |

### 7.3 `GET /documents`

Lista os metadados dos documentos pertencentes ao usuário indicado.

- Headers obrigatórios: `X-User-Id` não vazio.
- Sucesso: `200 OK`, `Content-Type: application/json`, documentos ordenados por `uploadedAt` descendente.
- Corpo de sucesso: `{ "documents": [<metadados públicos>, ...] }`. Sem documentos, retornar lista vazia.
- Erros:

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `MISSING_USER_ID` | Header ausente ou vazio. |
| `500` | `LIST_FAILED` | Falha inesperada ao consultar o repositório de metadados. |

### 7.4 `GET /documents/:id/download`

Transfere o conteúdo binário de um documento do usuário indicado.

- Headers obrigatórios: `X-User-Id` não vazio.
- Sucesso: `200 OK`, corpo binário; `Content-Disposition: attachment` com o nome original tratado para uso seguro em header. O `Content-Type` pode usar o MIME recebido no upload; se indisponível, usar `application/octet-stream`.
- Erros:

| Status | Código | Condição |
| --- | --- | --- |
| `400` | `MISSING_USER_ID` | Header ausente ou vazio. |
| `404` | `DOCUMENT_NOT_FOUND` | ID inexistente, pertencente a outro owner ou arquivo local indisponível. A resposta não deve distinguir esses casos. |
| `500` | `DOWNLOAD_FAILED` | Falha inesperada de leitura/transmissão antes do início da resposta. |

Se ocorrer falha após o início da transmissão, a conexão deve ser encerrada; não se deve tentar enviar um envelope JSON depois que o corpo binário começou.

### 7.5 `GET /health`

Verifica se a aplicação HTTP está respondendo. Não exige `X-User-Id`.

- Sucesso: `200 OK`, `Content-Type: application/json`.
- Corpo: `{ "status": "ok" }`.

## 8. Arquitetura e decisões

### 8.1 Backend

O fluxo de dependência deve permanecer `routes -> controllers -> services -> repositories`.

| Camada | Responsabilidade |
| --- | --- |
| `routes/` | Registrar os caminhos HTTP, aplicar o middleware Multer na rota de upload e delegar ao controller. |
| `controllers/` | Ler parâmetros, headers e resultado do upload; validar entrada HTTP básica; converter resultados/erros em status, headers e respostas HTTP. |
| `services/` | Aplicar regras de negócio, associar owner, gerar/validar metadados, impedir acesso a documentos de outro owner e coordenar repositórios. |
| `repositories/` | Manter metadados em memória e encapsular resolução, leitura e remoção compensatória de arquivos no filesystem local. |

Multer deve usar `diskStorage` apontando para `STORAGE_DIR` (padrão `backend/storage`) e ser configurado com o limite de tamanho. O nome físico deve ser gerado pelo servidor. Nenhum armazenamento externo é permitido. Camadas internas não devem depender de Express; os repositórios encapsulam filesystem e estrutura em memória.

O serviço de documentos separa a montagem de metadados da gravação com compensação e centraliza a tradução de falhas do repositório para `AppError`, preservando a causa original. Documento ausente ou arquivo removido continua sendo um erro de negócio `404`, não uma falha interna. Testes unitários do serviço usam repositórios falsos e não acessam o filesystem.

### 8.2 Frontend e integração

O frontend usa componentes React, páginas e um serviço de API baseado em `fetch`. O serviço chama o backend com prefixo `/api`; o proxy Vite já está configurado para encaminhar a `http://localhost:3000` e remover `/api`. O cliente deve enviar `X-User-Id` nas rotas documentais com a identidade local configurada para o MVP. A identidade usada no frontend não autentica nem protege dados contra chamadas diretas.

### 8.3 Configuração e limitações operacionais

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local de arquivos; deve ser resolvido de forma consistente independentemente do diretório corrente do processo. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo por arquivo em bytes. |

Os arquivos podem permanecer no disco após o reinício, mas o índice de metadados em memória será perdido. Esses arquivos tornam-se órfãos e não estarão disponíveis pela API. Recuperação, limpeza automática e persistência durável não fazem parte deste MVP.

## 9. Plano de execução futuro

As etapas abaixo são um roteiro de trabalho posterior. Nesta solicitação, somente este documento deve ser criado; não executar alterações nos arquivos de backend ou frontend.

1. Implementar a configuração do limite de upload e do diretório local, e conectar Multer `diskStorage` à rota de upload.
2. Implementar repositórios locais para arquivos e metadados em memória, com IDs gerados pelo servidor e associação ao owner.
3. Implementar serviços e controllers para upload, listagem e download, incluindo envelope de erro e isolamento por owner.
4. Cobrir os contratos com testes: upload válido/ausente/acima do limite, listagem ordenada e isolada, download válido, ID ausente, owner diferente e falhas de filesystem.
5. Construir a interface React para upload, listagem, download e estados de carregamento/erro; integrar por `fetch` via `/api`.
6. Validar build do frontend e fluxo integrado com backend, conferindo persistência local durante a execução, comportamento após reinício e ausência de dependência de armazenamento externo.

## 10. Critérios de aceite do MVP

- Upload válido retorna `201` e metadados públicos; o arquivo fica em `STORAGE_DIR` com nome gerado pelo servidor.
- Upload sem arquivo retorna `400`; arquivo acima do limite configurado retorna `413`.
- Listagem retorna somente documentos do `X-User-Id` informado e em ordem do mais recente para o mais antigo.
- Download funciona para documento do mesmo owner; IDs inexistentes e de outro owner retornam o mesmo `404`.
- Erros seguem o envelope definido; respostas não expõem caminhos locais nem stack traces.
- O frontend usa o proxy `/api` e oferece upload, listagem e download sem alterar a restrição de armazenamento local.
- Testes automatizados cobrem os contratos e não dependem de serviços externos.