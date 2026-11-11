import { z } from "zod";
import { zernioBaseUrl } from "../zernio/credentials";
export class SocialError extends Error {
  constructor(
    message: string,
    public status = 502,
    public upstreamStatus?: number,
  ) {
    super(message);
  }
}
/**
 * O que o provedor disse ao recusar, SEM o corpo cru: só `type`, `code` e `error`
 * (texto curto), um a um, com caracteres restritos e teto de tamanho. Sem isto um
 * 409 virava "HTTP 409" e ninguém sabia se era janela, link, permissão ou conta.
 * Nunca devolve o corpo inteiro nem campo fora dessa lista.
 */
async function motivoDoProvedor(response: Response): Promise<string> {
  try {
    const json: unknown = await response.json();
    if (typeof json !== "object" || json === null) return "";
    const o = json as Record<string, unknown>;
    const limpo = (v: unknown, max: number) =>
      typeof v === "string"
        ? v
            .replace(/[^\p{L}\p{N} _.:,;()/-]/gu, "")
            .trim()
            .slice(0, max)
        : "";
    const partes = [limpo(o.type, 40), limpo(o.code, 40), limpo(o.error ?? o.message, 160)].filter(
      Boolean,
    );
    return partes.length ? `: ${partes.join(" · ")}` : "";
  } catch {
    return "";
  }
}
/** Fixed provider origin. Credentials never follow a redirect to another host. */
export async function socialRequest(
  key: string,
  path: string,
  body?: unknown,
  method: "GET" | "POST" | "PUT" | "DELETE" = body === undefined ? "GET" : "POST",
): Promise<unknown> {
  const response = await fetch(`${zernioBaseUrl()}/v1/${path}`, {
    method,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const motivo =
      response.status === 401 || response.status === 403 ? "" : await motivoDoProvedor(response);
    throw new SocialError(
      response.status === 401 || response.status === 403
        ? "Acesso recusado. Confira a chave e as permissões no provedor."
        : `O provedor não concluiu a operação (HTTP ${response.status}${motivo}).`,
      response.status === 429 ? 429 : 502,
      response.status,
    );
  }
  // A DELETE may answer 204 or an empty body; nothing in it is needed.
  return method === "DELETE" ? null : response.json();
}
const accountSchema = z.object({
  _id: z.string(),
  platform: z.string(),
  username: z.string().nullish(),
  displayName: z.string().nullish(),
  isActive: z.boolean(),
  profileId: z.union([z.string(), z.object({ _id: z.string(), name: z.string().optional() })]),
});
export type SocialAccount = z.infer<typeof accountSchema>;
export async function listSocialAccounts(key: string, profileId: string): Promise<SocialAccount[]> {
  const parsed = z
    .object({ accounts: z.array(accountSchema) })
    .safeParse(await socialRequest(key, `accounts?profileId=${encodeURIComponent(profileId)}`));
  if (!parsed.success) throw new SocialError("O provedor retornou uma lista de contas inválida.");
  return parsed.data.accounts.filter(
    (a) => (typeof a.profileId === "string" ? a.profileId : a.profileId._id) === profileId,
  );
}
