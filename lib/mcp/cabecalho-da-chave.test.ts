import { describe, expect, it } from "vitest";

import { cabecalhoDaChave } from "./cabecalho-da-chave";

const h = (init: Record<string, string>) => new Headers(init);

describe("cabecalhoDaChave", () => {
  it("Authorization preenchido é devolvido sem mudança", () => {
    expect(cabecalhoDaChave(h({ authorization: "Bearer dsk_abc" }))).toBe("Bearer dsk_abc");
  });

  it("Authorization ganha do x-api-key quando os dois vêm", () => {
    expect(
      cabecalhoDaChave(h({ authorization: "Bearer dsk_a", "x-api-key": "dsk_b" })),
    ).toBe("Bearer dsk_a");
  });

  it("x-api-key cru vira Bearer", () => {
    expect(cabecalhoDaChave(h({ "x-api-key": "dsk_abc" }))).toBe("Bearer dsk_abc");
  });

  it("x-api-key que já vem com Bearer não ganha Bearer de novo", () => {
    expect(cabecalhoDaChave(h({ "x-api-key": "Bearer dsk_abc" }))).toBe("Bearer dsk_abc");
    expect(cabecalhoDaChave(h({ "x-api-key": "bearer dsk_abc" }))).toBe("bearer dsk_abc");
  });

  it("espaço em volta do x-api-key é ignorado", () => {
    expect(cabecalhoDaChave(h({ "x-api-key": "  dsk_abc  " }))).toBe("Bearer dsk_abc");
  });

  it("Authorization em branco cai para o x-api-key", () => {
    expect(cabecalhoDaChave(h({ authorization: "  ", "x-api-key": "dsk_abc" }))).toBe(
      "Bearer dsk_abc",
    );
  });

  it("sem nenhum dos dois (ou só vazio) devolve null", () => {
    expect(cabecalhoDaChave(h({}))).toBeNull();
    expect(cabecalhoDaChave(h({ "x-api-key": "   " }))).toBeNull();
  });
});
