---
impacto: exige_acao
secao: alterado
titulo: O fork Denispds publica e instala as próprias imagens, em ghcr.io/denispds
---

Só vale para o fork `Denispds/DeskcommCRM`: o dono da imagem deixa de ser `ghcr.io/melgarafael`
e passa a ser `ghcr.io/denispds` (`IMG_NS` em `hostgator-setup-kit/_common.sh`, os quatro
defaults de `docker-compose.prod.yml`, o `.env.hostgator.example`, a âncora dos testes e as URLs
do repositório no instalador, nos Dockerfiles e em `scripts/cortar-release.ts`).

Sem isso o `update.sh` regravava `APP_IMAGE` com a imagem do oficial e a instalação nunca
recebia o que o fork acrescenta (a primeira é `crm_create_contact`). O `publish-image.yml` já
publica em `github.repository_owner`, então o fork constrói em `ghcr.io/denispds/*` sem mudar o
workflow.

Para quem já tem a instalação: nada a editar. O `update.sh` regrava as quatro referências de
imagem sozinho. O pré-requisito é de fora do código: o clone da VPS precisa ter `origin` no fork,
e os pacotes do GHCR do fork precisam estar públicos.

## Requer atenção

Antes de atualizar uma VPS para esta versão: confirme que o `origin` do clone aponta para
`Denispds/DeskcommCRM` (com `origin` no oficial, o `git pull` traz o `IMG_NS` de volta para
`melgarafael`) e que os quatro pacotes do GHCR (`deskcommcrm`, `deskcomm-worker`,
`deskcomm-scheduler`, `deskcomm-voice-agent`) estão públicos, ou faça `docker login ghcr.io` na VPS.
