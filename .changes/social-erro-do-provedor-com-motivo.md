---
impacto: nada_mudou
secao: corrigido
titulo: Quando o provedor recusa o envio numa rede social (Instagram, Facebook), o erro passa a dizer o motivo curto
---

Uma recusa do provedor (por exemplo HTTP 409) aparecia só como "O provedor não
concluiu a operação (HTTP 409)", sem dizer se era janela de resposta, link,
permissão ou conta. Agora o erro leva o tipo, o código e o texto curto que o
provedor devolveu, com caracteres filtrados e tamanho limitado. O corpo cru da
resposta e qualquer outro campo continuam fora do erro.
