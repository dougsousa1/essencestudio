# Essence Studio: estado do projeto

Resumo para continuar o trabalho em outra conversa.

## Onde está tudo
- **Código:** github.com/dougsousa1/essencestudio, branch `claude/kind-goodall-nur8ba` (é a única branch e a branch de produção na Vercel).
- **Site (vitrine + biblioteca):** https://essencestudio.vercel.app (projeto Vercel `essencestudio`, time `dougsousa1s-projects`). Cada push na branch publica sozinho.
- **Janela de revisão do vídeo da cliente (página privada do Claude):** https://claude.ai/artifact/HvxU1GoZYcuzmur6hHSZmU. O projeto está no banco da página em `projeto/atual`; os botões criam documentos em `pedidos/*`.

## O que é o produto
Plugin do Claude Code no modelo do Yanny Studio: a pessoa arrasta um vídeo falando para a câmera, o Claude edita (cortes, legendas, título, efeitos de motion, sons) e ela revisa numa janela com Presets → Storyboard → Rascunho. Marca, textos e visual são próprios (looks Suave, Colagem, Editorial e Manchete; paletas com nomes próprios). Gerador de vídeo: Remotion 4.0.540 (decisão do dono do projeto; a licença do Remotion é paga para empresas com mais de 3 pessoas).

## Partes
- `.claude-plugin/`: manifestos do plugin. Instalação: `npx skills add dougsousa1/essencestudio` ou colar no Claude Code a frase do README.
- `skills/instalar`, `skills/editar` (fluxo completo + `references/entrevista-de-marca.md`), `skills/biblioteca` (ids dos 39 efeitos).
- `engine/`:
  - `new.mjs`: cria o projeto;
  - `transcribe.mjs`: whisper.cpp local, modelo `small`, junta pedaços de palavra e apaga modelo quebrado;
  - `render.mjs`: Remotion completo, `--draft` para meia resolução, escreve `status.txt`;
  - `doctor.mjs`: checagem;
  - `esperar.mjs`: espera o botão "Enviar para o Claude";
  - `vite-project-api.ts`: API local que liga a janela ao `project.json`.
- `src/`:
  - `core`: modelo, linha do tempo, presets, fontes, estado;
  - `remotion`: composição `Main`, `Root`/`index.ts` para render local, 4 looks;
  - `effects`: contrato, motor, 39 efeitos em 6 categorias, `EffectStage` para as prévias;
  - `ui`: páginas Início, Estúdio, Biblioteca e Revisão (`#/revisao?projeto=<pasta>`), além do modo página do Claude (`VITE_ARTIFACT=1`).
- Inspirações creditadas: Remocn (MIT), Remotion Elements, biblioteca de motion do apenasdouglas, claude-reel-editor (MIT).

## Testado
- Biblioteca e estúdio no navegador; exportação MP4 no navegador igual à prévia (auditoria efeito por efeito).
- Fluxo do plugin com vídeo real da cliente (69 s, ranking de suplementos): instalação, checagem, transcrição real (43 s), storyboard com 8 efeitos e rascunho (cerca de 6 min nesta nuvem).
- Janela local: o botão chega ao Claude e as edições do Claude aparecem na janela.

## Falta
1. **Janela como página do Claude:** abrir e confirmar que carrega (Remotion dentro do iframe); download do final precisa da capability `downloads`.
2. **Instalação num computador real** com o Claude Code conduzindo tudo sozinho.
3. **Contraste:** barra de progresso e checklist ficam apagados em fundo claro.
4. Recorte da pessoa (texto atrás dela), chave de licença e venda.

## Particularidades desta nuvem (não acontecem no computador do cliente)
- Liberados na rede: `huggingface.co` e `*.hf.co` (modelo do Whisper).
- Node precisa de `NODE_USE_ENV_PROXY=1` para baixar o modelo.
- Render local: `ESSENCE_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell ESSENCE_INSECURE_TLS=1`.
- O projeto da cliente estava em `~/Videos/Essence/cliente-teleprompter` desta máquina, que é temporária. A cópia que fica é a do banco da página privada.
