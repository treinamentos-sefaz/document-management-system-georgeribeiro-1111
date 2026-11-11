---
description: Implementa um recurso do backend seguindo as camadas e convenções do DMS.
name: scaffold-camada
argument-hint: nome do recurso e comportamento desejado
agent: agent
---

# Implementar recurso no backend

Implemente o recurso `${input:recurso:nome do recurso e comportamento desejado}` seguindo a Clean Architecture simples do projeto. Antes de alterar arquivos, examine as camadas existentes, os testes e o contrato da API. Se o comportamento ou os endpoints necessários não estiverem claros, peça esclarecimentos.

Use ou adapte as camadas necessárias em `backend/src`, seguindo os nomes e padrões existentes, como:

1. `routes/documentRoutes.js` - define os endpoints e delega ao controller.
2. `controllers/documentController.js` - trata entrada/saída HTTP e validação básica.
3. `services/documentService.js` - concentra as regras de negócio.
4. `repositories/documentRepository.js` - cuida da persistência.

Requisitos:

- Use JavaScript CommonJS e respeite o fluxo `routes -> controllers -> services -> repositories`.
- Reutilize a composição de dependências em `backend/src/app.js` e registre as rotas quando necessário.
- Preserve os endpoints e contratos existentes; não crie operações ou abstrações sem necessidade.
- Para documentos, mantenha o isolamento por `X-User-Id`, os metadados em memória e os arquivos locais usando `multer` com `diskStorage`. Não use armazenamento externo.
- Trate erros nos limites do sistema seguindo `AppError` e o middleware de erros existentes, sem expor detalhes internos.
- Adicione ou atualize testes em `backend/test` usando `node:test` e `node:assert/strict`. Cubra sucesso, validação e falhas relevantes; isole arquivos temporários e não dependa de serviços externos.
- Atualize a documentação diretamente relacionada quando o contrato mudar e execute `npm test` em `backend`. Informe o resultado e qualquer limitação.
