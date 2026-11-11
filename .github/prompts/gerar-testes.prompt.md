---
description: Gera testes isolados para um módulo do backend do DMS usando node:test.
name: gerar-testes
argument-hint: caminho do modulo (ex. backend/src/services/documents.service.js)
agent: agent
---

# Gerar testes do backend do DMS

Gere testes automatizados para o módulo `${input:modulo:caminho do modulo}`. Antes de escrever, leia o módulo, seus consumidores e os testes existentes para entender os contratos e seguir os padrões do projeto.

Requisitos:

- Use JavaScript CommonJS, o runner nativo `node:test` e `node:assert/strict`.
- Crie ou atualize testes em `backend/test`, sem alterar código de produção.
- Cubra comportamentos observáveis relevantes, incluindo sucesso, validação e falhas; não invente requisitos que o módulo ou contrato da API não definem.
- Respeite as responsabilidades das camadas: teste regras de negócio no service, persistência no repository, HTTP no controller/rotas e composição da aplicação quando necessário.
- Prefira dependências falsas simples para isolar services e controllers. Para testes HTTP, use `createApp` e as APIs nativas disponíveis no projeto.
- Se um teste precisar de arquivos, crie uma pasta temporária com `node:fs/promises` e `node:os`, e remova-a em `finally`. Nunca use nem apague `backend/storage`.
- Para documentos, verifique o isolamento por `X-User-Id`, os metadados públicos e os erros definidos pelo projeto quando forem relevantes ao comportamento testado.
- Não dependa de serviços externos nem adicione dependências.
- Execute `npm test` dentro de `backend` e informe os testes adicionados e o resultado. Se o comando falhar, reporte a falha sem ocultá-la.
