---
impacto: capacidade_nova
secao: adicionado
titulo: Uma integração com chave de API agora consegue cadastrar contatos, sem passar pela tela
---

Até aqui uma integração (ERP, outro CRM de vendas) com chave `dsk_` conseguia **ler**
contatos e **criar negócios**, mas não cadastrar o contato: o `crm_create_lead` só
aceita um contato que já exista, e o cadastro só saía pela tela de Contatos ou pela
importação de planilha (500 linhas por arquivo, sessão de navegador).

Nova ferramenta MCP **`crm_create_contact`** (nome, telefone, e-mail opcional, tags):

- **Idempotente pelo telefone.** Se o número já pertence a um contato da organização,
  devolve o contato existente (`criado: false`) e acrescenta as tags dadas — nunca
  cria um segundo. Repetir a chamada não duplica.
- **Não abre conversa e não envia mensagem.** O contato nasce frio, como na
  importação de planilha (nova porta de criação `integracao`, em
  `lib/contacts/conversa-ao-criar.ts`). Ninguém cai na Inbox por causa de uma lista.
- **Telefone inválido ou sem DDD** volta como `motivo: dados_invalidos`, sem criar nada.
- **Exige `mcp:write` e papel gerente** (`role:manager` ou `role:admin`). O agente de IA
  que atende não alcança a ferramenta; um token sem papel recebe 403.

Nada muda para quem não usa integração: a tela, o `POST /api/v1/contacts` e a
importação de planilha se comportam como antes (a ficha criada à mão continua abrindo
a conversa). A chave não ganha poder novo sozinha: só quem já tem `mcp:write` e papel
de gerente passa a ver a ferramenta.
