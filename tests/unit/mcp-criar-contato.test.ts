import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/types";
import type { perfilDoPais as perfilDoPaisReal } from "@/lib/legal/perfil-do-pais";

/**
 * `crm_create_contact` — a porta de criação de contato para a chave de
 * integração (ERP, outro CRM). O que a prova protege:
 *
 *  1. cria pelo MESMO handler da tela, pela porta `integracao` (que NÃO abre
 *     conversa: contato frio não entra na Inbox nem a caminho de mensagem);
 *  2. é idempotente pelo telefone: número que já existe devolve o contato, não
 *     cria o segundo, e acrescenta as tags (a menos que se peça o contrário);
 *  3. telefone inválido ou sem DDD volta estruturado e NÃO chama o handler;
 *  4. a organização vem do contexto do token, nunca do argumento;
 *  5. exige `mcp:write` e papel `manager` (o agente de IA fica de fora).
 *
 * ─── SABOTAGEM (prova no CI) ───────────────────────────────────────────────
 * - Trocar `"integracao"` por `"manual"` na chamada do handler: o caso 1 cai
 *   (a conversa voltaria a abrir para cada contato da lista).
 * - Tirar o `.eq("organization_id", …)` da releitura/atualização de tags: o
 *   caso 2 cai (a tag poderia ser gravada em contato de outra organização).
 * - Baixar `requiresRole` para `agent`: o caso 5 cai.
 * Linha para reverter: `lib/mcp/tools/contacts.ts` (`crmCreateContact`).
 */

const criarMock = vi.fn();

vi.mock("@/app/api/v1/contacts/_handler", () => ({
  listContactsHandler: vi.fn(),
  getContactHandler: vi.fn(),
  createContactHandler: (...args: unknown[]) => criarMock(...args),
}));

vi.mock("@/lib/legal/perfil-do-pais", async () => {
  const real: Record<string, unknown> & { perfilDoPais: typeof perfilDoPaisReal } =
    await vi.importActual("@/lib/legal/perfil-do-pais");
  // Organização brasileira, sem ir ao banco.
  return { ...real, perfilDaOrganizacao: async () => real.perfilDoPais("BR") };
});

import { crmCreateContact } from "@/lib/mcp/tools/contacts";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "33333333-3333-4333-8333-333333333333";

interface Chamada {
  tabela: string;
  filtros: Array<[string, unknown]>;
  atualizacao?: Record<string, unknown>;
}

/** Banco de mentira: guarda cada leitura/escrita e devolve as tags que o contato já tem. */
function bancoDeMentira(tagsAtuais: string[]) {
  const chamadas: Chamada[] = [];
  const from = (tabela: string) => {
    const reg: Chamada = { tabela, filtros: [] };
    chamadas.push(reg);
    const cadeia: Record<string, unknown> = {
      select: () => cadeia,
      update: (u: Record<string, unknown>) => {
        reg.atualizacao = u;
        return cadeia;
      },
      eq: (coluna: string, valor: unknown) => {
        reg.filtros.push([coluna, valor]);
        return cadeia;
      },
      maybeSingle: async () => ({ data: { tags: tagsAtuais }, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error: null }),
    };
    return cadeia;
  };
  return { from, chamadas };
}

function ctx(supabase: unknown) {
  return {
    supabase,
    organizationId: ORG,
    actor: { type: "api_token", id: "tok" },
    requestId: "req-1",
    apiTokenId: "tok",
  } as never;
}

beforeEach(() => {
  criarMock.mockReset();
});

describe("crm_create_contact — contrato da ferramenta", () => {
  it("é de escrita, exige mcp:write e papel manager (o agente de IA não alcança)", () => {
    expect(crmCreateContact.category).toBe("write");
    expect(crmCreateContact.requiresScope).toBe("mcp:write");
    expect(crmCreateContact.requiresRole).toBe("manager");
  });
});

describe("crm_create_contact — criar", () => {
  it("cria pela porta integracao, com a organização do contexto, e não abre conversa", async () => {
    criarMock.mockResolvedValue({ contact: { id: CONTATO }, action: "created" });
    const banco = bancoDeMentira([]);

    const r = (await crmCreateContact.handler(
      {
        name: "MARIA TESTE",
        phone_number: "(62) 99999-8888",
        tags: ["Campanha-X", "erp-1"],
        merge_tags_if_exists: true,
      },
      ctx(banco),
    )) as Record<string, unknown>;

    expect(r).toEqual({ criado: true, contact_id: CONTATO, conversa_aberta: false });
    const [, handlerCtx, input, ligado, porta] = criarMock.mock.calls[0]!;
    expect(handlerCtx.organization_id).toBe(ORG);
    expect(input.phone_number).toBe("+5562999998888");
    expect(input.source).toBe("integracao");
    expect(input.tags).toEqual(expect.arrayContaining(["erp-1"]));
    expect(ligado).toBeUndefined();
    expect(porta).toBe("integracao");
  });
});

describe("crm_create_contact — dados inválidos", () => {
  it("telefone sem DDD volta estruturado e o handler nem é chamado", async () => {
    const r = (await crmCreateContact.handler(
      { name: "SEM DDD", phone_number: "99999-8888", merge_tags_if_exists: true },
      ctx(bancoDeMentira([])),
    )) as { criado: boolean; motivo: string; problemas: Array<{ campo: string }> };

    expect(r.criado).toBe(false);
    expect(r.motivo).toBe("dados_invalidos");
    expect(r.problemas.some((p) => p.campo === "phone_number")).toBe(true);
    expect(criarMock).not.toHaveBeenCalled();
  });
});

describe("crm_create_contact — idempotência pelo telefone", () => {
  const jaExiste = () =>
    criarMock.mockRejectedValue(
      new ApiError(409, "contact_exists", { contact_id: CONTATO }, "req-1", "Já existe um contato com este telefone."),
    );

  it("telefone existente: devolve o contato, acrescenta só as tags novas e filtra pela organização", async () => {
    jaExiste();
    const banco = bancoDeMentira(["atacado"]);

    const r = (await crmCreateContact.handler(
      { name: "MARIA", phone_number: "62999998888", tags: ["atacado", "erp-9"], merge_tags_if_exists: true },
      ctx(banco),
    )) as Record<string, unknown>;

    expect(r).toEqual({
      criado: false,
      motivo: "ja_existe",
      contact_id: CONTATO,
      tags_acrescentadas: ["erp-9"],
      conversa_aberta: false,
    });
    const escrita = banco.chamadas.find((c) => c.atualizacao);
    expect(escrita?.atualizacao?.tags).toEqual(expect.arrayContaining(["atacado", "erp-9"]));
    // O filtro de organização é explícito na leitura E na escrita (o cliente do
    // MCP é service role e não passa pela RLS).
    for (const c of banco.chamadas) {
      expect(c.filtros).toContainEqual(["organization_id", ORG]);
      expect(c.filtros).toContainEqual(["id", CONTATO]);
    }
  });

  it("merge_tags_if_exists=false: devolve o contato e não escreve nada", async () => {
    jaExiste();
    const banco = bancoDeMentira([]);

    const r = (await crmCreateContact.handler(
      { name: "MARIA", phone_number: "62999998888", tags: ["erp-9"], merge_tags_if_exists: false },
      ctx(banco),
    )) as Record<string, unknown>;

    expect(r).toMatchObject({ criado: false, motivo: "ja_existe", contact_id: CONTATO, tags_acrescentadas: [] });
    expect(banco.chamadas).toEqual([]);
  });

  it("erro que não é de duplicidade continua subindo (não vira sucesso)", async () => {
    criarMock.mockRejectedValue(new ApiError(500, "internal_error", undefined, "req-1"));
    await expect(
      crmCreateContact.handler(
        { name: "MARIA", phone_number: "62999998888", merge_tags_if_exists: true },
        ctx(bancoDeMentira([])),
      ),
    ).rejects.toMatchObject({ code: "internal_error" });
  });
});
