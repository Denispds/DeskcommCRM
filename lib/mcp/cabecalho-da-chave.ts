/**
 * De qual cabeçalho sai a chave `dsk_` de um pedido MCP.
 *
 * O padrão é `Authorization: Bearer dsk_...`. O conector personalizado do
 * claude.ai não deixa usar `Authorization` como cabeçalho fixo (o nome é
 * reservado ao login OAuth dele) e oferece `x-api-key`; por isso a chave também
 * é aceita ali, crua ou já com "Bearer ".
 *
 * `Authorization` preenchido sempre ganha. Esta função só escolhe o cabeçalho:
 * a validação do token (teto de falhas, escopos, empresa) continua toda em
 * `validateBearerToken`.
 */
export function cabecalhoDaChave(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization !== null && authorization.trim() !== "") return authorization;

  const apiKey = headers.get("x-api-key")?.trim();
  if (!apiKey) return null;
  return /^bearer\s/i.test(apiKey) ? apiKey : `Bearer ${apiKey}`;
}
