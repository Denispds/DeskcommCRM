import { afterEach, describe, expect, it, vi } from "vitest";
import { listSocialAccounts, socialRequest } from "./client";
afterEach(() => vi.unstubAllGlobals());
describe("social provider boundary", () => {
  it("filters upstream accounts by the configured profile and projects no credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accounts: [
              { _id: "a", platform: "instagram", isActive: true, profileId: { _id: "p" } },
              { _id: "b", platform: "facebook", isActive: true, profileId: "other" },
            ],
          }),
        ),
      ),
    );
    expect((await listSocialAccounts("test-key", "p")).map((a) => a._id)).toEqual(["a"]);
  });
  it("never includes upstream error bodies or credentials in errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-body", { status: 403 })));
    await expect(socialRequest("test-key", "profiles")).rejects.toThrow("Acesso recusado");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: "error", cache: "no-store" }),
    );
  });
  it("carrega o motivo curto do provedor num 409, sem o corpo cru nem campos fora da lista", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              type: "platform_error",
              code: "ig_window",
              error: "Fora da janela",
              token: "tok-secreto",
            }),
            { status: 409 },
          ),
        ),
    );
    const erro = await socialRequest("test-key", "inbox/x/messages", { a: 1 }).catch((e) => e);
    expect(erro.message).toBe(
      "O provedor não concluiu a operação (HTTP 409: platform_error · ig_window · Fora da janela).",
    );
    expect(erro.message).not.toContain("tok-secreto");
    expect(erro.upstreamStatus).toBe(409);
  });
  it("mantém só o número quando o corpo do erro não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>x</html>", { status: 409 })),
    );
    await expect(socialRequest("test-key", "p", { a: 1 })).rejects.toThrow(
      "O provedor não concluiu a operação (HTTP 409).",
    );
  });
});
