---
name: instalar
description: Instala e checa o Essence Studio no computador (motor de vídeo, ffmpeg, Node, modelo de transcrição). Use na primeira vez, quando o usuário colar "instale o Essence Studio…", disser "instalar", "configurar o estúdio", "rodar a checagem", ou quando a skill editar encontrar algo faltando.
---

# Instalar o Essence Studio

O usuário não é técnico. Faça tudo sozinho, com mensagens curtas e simples. Só peça algo quando for impossível fazer por ele (por exemplo, a senha do computador num comando do Homebrew).

## Onde fica o app
`R` = `~/.essence-studio/app`, uma cópia do repositório `github.com/dougsousa1/essencestudio`.
- Se `R` não existe: `git clone --depth 1 https://github.com/dougsousa1/essencestudio.git ~/.essence-studio/app`.
- Se existe: `git -C ~/.essence-studio/app pull --ff-only` para atualizar.
- Sem git no Windows: `winget install Git.Git`. No Mac, o próprio sistema oferece instalar.

## Passos
1. `cd "$R" && npm install` (alguns minutos na primeira vez).
2. Rode a checagem: `node "$R/engine/doctor.mjs"`.
3. Resolva cada item com ❌ usando o comando que a checagem mostra, e rode a checagem de novo até aparecer **PRONTO** ou **PRONTO COM LIMITES**.
4. Termine com: "Tudo pronto! Para editar, arraste um vídeo aqui e escreva *editar*."

Nunca mostre logs longos. Se algo falhar duas vezes, explique em uma frase o que faltou e o que a pessoa precisa fazer.
