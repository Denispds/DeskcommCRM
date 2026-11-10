# Catálogo Dande dentro da conversa do Inbox — design

Data: 10/11/2026 · Escopo: **só o fork `Denispds/DeskcommCRM`** (decisão do Denis: nada no oficial) · Status: **rascunho, não aprovado**.

**Destino (DoD 18):** *extensão do fork*. Pergunta da doutrina: "se nenhuma organização ativar isto, a operação comum continua inteira?" — sim: sem as variáveis de ambiente o botão não aparece e o Inbox é idêntico ao oficial. Não altera schema nem o baseline.

## Intenção

O vendedor da Dande, dentro de uma conversa, procura peças do Catálogo Dande, marca as que quer e as envia ao cliente sem sair do chat. O vendasia (`vendasia.cloud`) já faz isto; o Denis quer o mesmo no Deskcomm, que é onde as conversas passam a viver. Esta é a porta do vendedor; o agente de IA do Deskcomm tem outra (MCP externo) e fica fora.

## Objetivos

1. Botão de catálogo no compositor do Inbox, ao lado do anexo, que abre o modal "Buscar no catálogo".
2. Busca por nome ou código (≥ 2 caracteres), categoria, departamento, preço mín/máx e "só com foto"; paginação de 10 em 10 ("Ver mais"); resposta velha descartada.
3. Seleção de produtos e de coleções que sobrevive a novas buscas, com chips em "Vai enviar" e botão "Enviar (N)".
4. Envio: **uma mensagem de texto por item**, pelo MESMO caminho do compositor (`POST /api/v1/messages` via `useSendMessage`), de modo que canal, janela de 24 h, opt-out, limite e retry do Deskcomm valem sem código novo.
5. Card de prévia (foto, nome, preço) no balão da mensagem enviada.

## Fora de escopo e anti-objetivos

- Estoque, preço por perfil de cliente, envio de foto como mídia (o vendasia também não tem; a foto vem do card que o WhatsApp monta a partir do link).
- Não portar a ferramenta do agente de IA nem o MCP `buscar_catalogo`.
- Não copiar o catálogo para o banco do Deskcomm (decisão anterior do Denis: consulta ao vivo, sem cópia).
- Anti-objetivo: a chave da busca **nunca** chega ao navegador, e o link do card **nunca** é aceito do navegador sem validação.

## O contrato da fonte (medido pelo `crm-vendas-ia` em 10/11/2026)

`POST https://ajlhjfrwykfwrmvovvel.supabase.co/functions/v1/catalog-search`, `Authorization: Bearer <chave>`. Corpo: `{ q?, categoria?, departamento?, preco_min?, preco_max?, colecao?, so_com_imagem?, page? }`; sem critério algum → HTTP 400. Página = 10 produtos; `total` conta o conjunto inteiro; ~2 s por chamada. Resposta: `produtos[]` (`codigo`, `nome`, `preco` number em reais, `categoria`, `departamento`, `colecoes[]`, `imagem_url`, `tem_foto`, `url_produto`, `url_share`), `colecoes[]` (`id`, `nome`, `slug`, `descricao`, `imagem_capa`, `url_share`), `total`, `page`, `tipo_busca`, `url_busca`, `avisos[]` (ex.: `colecao_nao_encontrada`). O `nome` pode vir com ou sem o prefixo "código - ": tratar os dois. Categorias (41) e departamentos (12) são listas fixas no vendasia; a API casa por nome sem acento e sem caixa.

Lista de coleções completa: leitura direta de `cat_colecoes` (ativa = true) por PostgREST com a chave anon pública do catálogo.

**Marcar uma coleção NÃO filtra a busca de produtos:** ela vira um item de envio (uma mensagem com o link da vitrine, sem expandir em produtos). Assim é no vendasia.

## Decisões de desenho (minhas, a aprovar)

1. **Proxy no servidor.** Uma rota `GET /api/v1/catalogo/busca` (e `.../colecoes`) no Deskcomm, com papel mínimo `agent`, `requireSupportWrite` não se aplica (só leitura), organização do contexto. Ela chama a Edge Function com a chave de `CATALOG_SEARCH_SECRET` (env, `lib/env.ts` + `.env.example`), valida a resposta com Zod, aplica timeout de 10 s e devolve `ok()`/`fail()` no envelope do produto. Sem a variável, a rota responde 404 e o botão não é desenhado.
2. **Mensagem enviada** = texto (`*NOME*\n<url_share>`; coleção: `*Coleção: Nome*\n<descrição>\n<url_share>`). Sem preço no texto, como no vendasia.
3. **Card no balão** lê `metadata.catalogPreview { kind, name, imageUrl, price?, shareUrl }`. O `metadata` do `POST /api/v1/messages` é entrada do cliente — o `_handler.ts` já o trata assim —, então o card só renderiza se `shareUrl` for `https://dande.site/...` e `imageUrl` for `https` do domínio do catálogo; qualquer outra coisa vira a mensagem de texto comum, sem card. Lista de hosts em constante única, com teste.
4. **Ajustes sobre o vendasia (a aprovar pelo Denis):** (a) esconder produto com preço ≤ 0 (no vendasia aparece R$ 0,00); (b) teto de 10 itens por clique; (c) `avisos` da busca mostrados ao vendedor (no vendasia o modal os ignora).
5. **Envio sequencial** com `for…await`; falha no meio interrompe e informa "enviados X de N"; cada item usa uma `Idempotency-Key` própria (o `useSendMessage` já faz).
6. **Textos** passam por `useT` (pt-BR, en, es), como o resto do Inbox.

## Restrições

- Fork apenas; branch → PR no fork; nunca `main` direto; fragmento em `.changes/` (`capacidade_nova`).
- Chaves e URLs privadas só em `.env` da VPS; nunca no chat nem no repositório.
- Teste unitário para a rota (sem variável → 404; resposta fora do schema → erro; org do contexto), para a regra do card (host fora da lista → sem card) e para o modal (seleção sobrevive a nova busca; envio parcial). Prova pela tela com conta de teste, como manda a doutrina de QA visual.
- Deploy depende de a VPS rodar a imagem do FORK (hoje roda a do oficial 1.105.0): o conserto do `update.sh` é pré-requisito, e a variável precisa ser posta no `.env` da VPS pelo Denis.

## O que fica para quem constrói

Estrutura interna do modal (componentes, estados), cópia dos textos, o desenho dos chips e o do card dentro do tema do Deskcomm, e a forma do cache das coleções.

## Decisões menores (minhas — o construtor pode ajustar sem voltar ao Denis)

- **Hosts do card (medidos pelo `crm-vendas-ia` em 10/11/2026).** `shareUrl`: `https://dande.site/share?p=<codigo>` (produto) e `https://dande.site/share?c=<slug>` (coleção) — host `dande.site`. `imageUrl`: `https://ajlhjfrwykfwrmvovvel.supabase.co/functions/v1/image-proxy?...` (produto e capa de coleção, mesmo proxy). A lista fica numa constante única (`dande.site` e o host do catálogo, só `https`, e o caminho `/functions/v1/image-proxy` para imagem); host fora da lista = sem card, mensagem de texto comum.
- **Variáveis de ambiente.** `CATALOG_SEARCH_SECRET` liga o recurso (ausente = rota 404 e botão oculto). `CATALOG_SEARCH_URL` é opcional, com a URL medida como padrão. `CATALOG_ANON_KEY` é opcional: sem ela a busca funciona e a lista completa de coleções fica oculta. Todas em `lib/env.ts` e `.env.example`; nenhum valor no repositório.
- **Canais.** O botão aparece só em conversa de canal WhatsApp (WAHA ou Cloud), onde o link vira card; nos demais fica oculto. O texto com link funcionaria em qualquer canal de texto, mas a prévia visual é do WhatsApp.
- **Lote e throttle.** Mensagem devolvida como `queued` (canal desacelerado) conta como aceita e não interrompe o lote; falha de verdade interrompe e informa "enviados X de N". "Tentar de novo" reenvia só os itens que faltam; a seleção do que já saiu é desmarcada.
- **Nome.** O prefixo "código - " é removido do texto e do card (como no vendasia); o código não aparece na mensagem.
- **Schema do `metadata`.** A chave `catalogPreview` é lida com `extract` tolerante (null se inválida), como `lerBotoesDoModelo`; o construtor confere o Zod de `metadata` de `POST /api/v1/messages` antes de gravar.

## Perguntas em aberto

Só a aprovação do Denis nos três ajustes sobre o vendasia (preço ≤ 0 oculto, teto de 10 itens, avisos da busca mostrados).
