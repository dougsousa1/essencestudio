# Essence Studio

Estúdio de edição de Reels que roda direto no navegador, feito com [Remotion](https://www.remotion.dev).
A pessoa envia o vídeo, corta pelas palavras, escolhe um look, ajusta cores e fontes vendo a prévia ao vivo e exporta o MP4. O vídeo nunca sai do computador dela.

## Fluxo

1. **Vídeo**: envio do arquivo e escolha do formato (9:16, 1:1, 16:9).
2. **Cortar**: transcrição automática com Whisper via WebGPU (`@remotion/whisper-webgpu`). Remove silêncios e vícios ("né", "tipo"…). Clique nas palavras para cortar, destacar ou pôr som.
3. **Estilo**: 4 looks (Soft, Scrapbook, Signature, Headline), paletas, cores livres, 18 fontes do Google, modos de legenda (palavra, frase, karaokê), animações, movimento, correção de cor, vinheta e granulação. Estilos podem ser salvos.
4. **Som**: efeitos sonoros (pop, swish, brilho, papel, clique, whoosh) no momento exato das palavras.
5. **Exportar**: MP4 gerado no navegador (`@remotion/web-renderer`), capa em JPG e legenda do post.

## Rodar localmente

```bash
npm install
npm run dev
```

Use o Google Chrome: ele tem suporte completo a WebGPU (transcrição) e WebCodecs (exportação).

## Estrutura

- `src/core`: modelo do projeto, cortes/linha do tempo, fontes, presets e estado (zustand).
- `src/remotion`: composição `Main`, blocos compartilhados (`parts.tsx`) e um arquivo por look em `looks/`.
- `src/features`: transcrição e exportação.
- `src/ui`: interface do estúdio (prévia e painéis de cada passo).
- `public/sfx`: efeitos sonoros (gerados por `scripts/make-sfx.sh`).
- `.claude/skills`: skills oficiais do Remotion para o Claude Code.

### Criar um look novo

1. Adicione o id em `LookId` (`src/core/types.ts`) e os padrões em `LOOKS` (`src/core/presets.ts`).
2. Crie `src/remotion/looks/MeuLook.tsx` seguindo `Soft.tsx` e registre em `LOOK_COMPONENTS` (`src/remotion/Main.tsx`).
3. Use só CSS suportado pela exportação no navegador: nada de `radial-gradient`, `background: url()` ou `clip-path`. Veja `.claude/skills/remotion-saas`.

## Licença do Remotion

O Remotion é gratuito para pessoas físicas e empresas de até 3 pessoas. Acima disso é preciso uma [licença de empresa](https://www.remotion.pro).
