---
name: instalar
description: Instala o Essence Studio no computador (Node, ffmpeg, dependências, modelo de transcrição). Use na primeira vez, quando o usuário disser "instalar", "configurar o estúdio", ou quando a skill editar encontrar ferramentas faltando.
---

# Instalar o Essence Studio

O usuário não é técnico. Faça tudo sozinho, com mensagens curtas e simples. Só peça algo quando for impossível fazer por ele (por exemplo, a senha do computador).

`R` abaixo é a pasta raiz deste plugin (a pasta que contém `.claude-plugin/`).

1. Confira as ferramentas: `node -v` (precisa de 20 ou mais), `ffmpeg -version`, `ffprobe -version`.
   - Mac sem ffmpeg: `brew install ffmpeg` (sem Homebrew, peça para o usuário colar o comando de instalação do brew.sh no Terminal).
   - Windows sem ffmpeg: `winget install Gyan.FFmpeg`. Sem Node: `winget install OpenJS.NodeJS.LTS`.
2. `cd "$R" && npm install` (uma vez; pode levar alguns minutos).
3. Baixe o modelo de transcrição testando em silêncio: crie um vídeo de 1 s com ffmpeg numa pasta temporária, rode `node "$R/engine/new.mjs"` e `node "$R/engine/transcribe.mjs"` nele. Na primeira vez isso baixa o whisper.cpp e o modelo (cerca de 500 MB) para `~/.essence-studio/`.
4. Pergunte só duas coisas e salve em `~/.essence-studio/marca.json`:
   - a pasta onde ficam os vídeos editados (padrão: `~/Movies/Essence` no Mac, `~/Videos/Essence` no Windows);
   - o @ do Instagram (aparece em alguns efeitos).
5. Diga: "Pronto! Para editar, é só arrastar um vídeo aqui e escrever *editar*."
