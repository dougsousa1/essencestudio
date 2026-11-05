# Essence Studio

Estúdio de edição de Reels que roda direto no navegador, feito com [Remotion](https://www.remotion.dev).
O vídeo nunca sai do computador da pessoa.

O app tem três partes:

- **Início** (`#/`): apresenta o produto e permite arrastar um vídeo para começar.
- **Estúdio** (`#/studio`): edição em 6 passos, com prévia ao vivo numa moldura de celular.
- **Biblioteca de efeitos** (`#/biblioteca`): efeitos de motion com prévia, botão "Usar no meu vídeo" e "Copiar" (o pedido em texto, para colar no Claude ou ChatGPT).

## Passos do estúdio

1. **Vídeo**: envio do arquivo e escolha do formato (9:16, 1:1, 16:9).
2. **Cortar**: transcrição com Whisper via WebGPU (`@remotion/whisper-webgpu`). Remove silêncios e vícios ("né", "hã"…). Clique nas palavras para cortar, destacar ou pôr som.
3. **Estilo**: 4 looks (Soft, Scrapbook, Signature, Headline), paletas, cores livres, fontes do Google, tamanho e posição das legendas, modo das legendas, movimento e correção de cor. Estilos podem ser salvos.
4. **Efeitos**: "uma palavra = um efeito". Escolha um efeito, veja a prévia no seu vídeo e clique na palavra que dispara o efeito. Cada efeito tem texto, cores, duração e som editáveis.
5. **Som**: efeitos sonoros (pop, swish, brilho, papel, clique, whoosh) no momento exato das palavras.
6. **Exportar**: MP4 gerado no navegador (`@remotion/web-renderer`), capa em JPG e legenda do post.

## Rodar localmente

```bash
npm install
npm run dev
```

Use o Google Chrome: ele tem suporte completo a WebGPU (transcrição) e WebCodecs (exportação).

## Estrutura

- `src/core`: modelo do projeto, cortes e linha do tempo, fontes, presets e estado (zustand).
- `src/remotion`: composição `Main`, blocos compartilhados (`parts.tsx`) e um arquivo por look em `looks/`.
- `src/effects`: biblioteca de efeitos.
  - `types.ts`: o contrato de um efeito (campos editáveis e camadas `Overlay`, `Backdrop` e `videoStyle`).
  - `runtime.tsx`: posiciona os efeitos nas palavras e desenha as camadas.
  - `EffectStage.tsx`: prévia de um efeito sobre uma silhueta, usada na biblioteca.
  - `library/*.tsx`: os efeitos, por categoria.
- `src/features`: transcrição e exportação.
- `src/ui`: páginas (`pages/`), painéis do estúdio (`panels/`) e componentes (`kit.tsx`).
- `public/sfx`: efeitos sonoros (gerados por `scripts/make-sfx.sh`).
- `.claude/skills`: skills oficiais do Remotion para o Claude Code.

### Criar um efeito novo

1. Escolha o arquivo da categoria em `src/effects/library/` e adicione um `EffectDef` ao array exportado.
2. Use `Overlay` para desenhar por cima, `Backdrop` para desenhar atrás do vídeo e `videoStyle` para transformar o vídeo. `VideoCopy` desenha uma cópia sincronizada do vídeo (para grades, polaroids, telas de celular).
3. Leia as cores e fontes de `style` para o efeito combinar com o look escolhido.
4. Use só CSS suportado pela exportação no navegador: nada de `radial-gradient`, `background: url()`, `clip-path` ou 3D real. Filtros em elementos com filhos precisam de `subtreeFilter()` (`src/effects/util.ts`).

Inspirações e fontes de código: [Remocn](https://remocn.dev) (MIT), [Remotion Elements](https://www.remotion.dev/elements) e a [biblioteca de motion do apenasdouglas](https://github.com/apenasdouglas/ai-motion-library).

## Licença do Remotion

O Remotion é gratuito para pessoas físicas e empresas de até 3 pessoas. Acima disso é preciso uma [licença de empresa](https://www.remotion.pro).
