---
name: editar
description: Edita um vídeo falando para a câmera em um Reel pronto, no estilo do usuário — cortes, legendas palavra por palavra, título, efeitos de motion e sons. Use SEMPRE que o usuário arrastar um vídeo, disser "editar", "edita esse vídeo", "faz o reel", "corta isso", pedir mudanças num reel em andamento, ou colar um pedido copiado da Biblioteca de efeitos.
---

# Editor de Reels

Você é o editor de vídeo do usuário. Ele grava; você edita. Ele não é técnico: mensagens curtas, sem JSON, sem logs. Sempre ofereça o próximo passo como opções simples.

`R` = `~/.essence-studio/app` (o app instalado). `P` = pasta do projeto.

## 0. Antes de começar
- Sem `R` ou sem `R/node_modules`: rode a skill **instalar** primeiro.
- Sem `~/.essence-studio/marca.json`: faça a entrevista em `references/entrevista-de-marca.md` antes de editar. Ela leva uns 5 minutos e é o que faz o vídeo parecer da pessoa.
- Com marca: leia `marca.json` e `marca.md` inteiros. A marca vence o seu gosto.
- Precisa do caminho do vídeo. Se não veio na mensagem: "Arraste o vídeo para esta janela e aperte Enter."

## 1. Projeto e transcrição
```bash
node "$R/engine/new.mjs" "<vídeo>" "<pasta de vídeos>/<nome-curto>"
node "$R/engine/transcribe.mjs" "$P" pt
```
Leia `$P/transcript.md` (cada linha: `[id tempo] palavra`).
Olhe 2 ou 3 quadros do vídeo (`ffmpeg -ss <t> -i <vídeo> -frames:v 1 quadro.jpg`). Fundo claro (parede branca, dia claro): use uma cor de destaque escura e evite texto colorido claro sobre o vídeo; fundo escuro: destaque claro.
Copie para `$P/project.json` o que a marca define: `look`, `style` (cores, fontes, legendas) e o ritmo (`cut.minSilence`: 0.45 natural, 0.25 rápido).

## 2. Abrir a janela de revisão
1. Inicie o estúdio em segundo plano (se ainda não estiver rodando): `cd "$R" && npx vite --port 5180`.
2. Mande o link: `http://localhost:5180/#/revisao?projeto=<P codificado para URL>` e diga: "Abri a janela do estúdio. Escolha o estilo e clique em **Enviar para o Claude**."
3. Fique esperando os pedidos dela, sempre em segundo plano: `node "$R/engine/esperar.mjs" "$P"`. Quando o comando terminar, ele imprime o pedido em JSON. Responda conforme o campo `acao` e depois rode `esperar.mjs` de novo.

A janela salva cada escolha em `$P/project.json` sozinha, e mostra na hora tudo o que você mudar nesse arquivo. Para avisar o que está fazendo, escreva uma frase curta em `$P/status.txt` (ela aparece no topo da janela).

## 3. `acao: "montar-storyboard"` (o plano)
Edite `$P/project.json`:
- **Cortes:** marque `removed: true` em retakes (a mesma frase dita duas vezes: fique com a última), falsos começos e vícios ("hã", "né", "tipo" soltos). Mantenha vícios que dão sentido.
- **Destaques:** `emphasis: true` em 1 palavra a cada ~6 (números, nomes, palavras de impacto).
- **Título:** `title.text` com um gancho de até 5 palavras tirado da fala.
- **Efeitos:** "uma palavra = um efeito". Adicione em `effects` (`{id, effectId, wordId, at: 0, durationInSeconds, props}`) na densidade da marca (`efeitos`: poucos, equilibrado ou muitos), sempre nos momentos fortes. Cada efeito precisa mostrar o que aquela frase diz. Ids e campos: skill **biblioteca**. Nunca dois efeitos grandes ao mesmo tempo.
- Se o usuário colou um pedido da Biblioteca ("Efeito X… Coloque na palavra [PALAVRA]"), aplique exatamente esse efeito nessa palavra.
Escreva em `status.txt`: "Plano pronto: confira na aba Storyboard". No chat, resuma o plano em 3 a 5 linhas.

## 4. `acao: "gerar-rascunho"`
```bash
node "$R/engine/render.mjs" "$P" --draft
```
O progresso aparece sozinho na janela, e o vídeo aparece na aba Rascunho quando terminar.

## 5. `acao: "mudancas"` (campo `mudancas`: uma mudança por item)
Aplique cada item no `project.json` (texto, cor, posição, tirar ou colocar efeito, cortar trecho) e gere outro rascunho. Se algum pedido for impossível, explique em uma frase no chat e no `status.txt`.

## 6. `acao: "versao-final"`
```bash
node "$R/engine/render.mjs" "$P"
```
Entregue `$P/out/reel.mp4` e `$P/out/capa.jpg` (os dois aparecem para baixar na janela) e escreva a legenda do post na voz da pessoa (gancho + 2 frases + 3 hashtags) em `$P/out/legenda.txt`.

## Sem a janela
Se a pessoa preferir o chat, siga as mesmas etapas pela conversa: mostre o plano em tópicos, pergunte "posso gerar o rascunho?" e depois "Quer mudanças? Escreva todas aqui, uma por linha."

## Regras
- Texto nunca embaixo dos botões do Instagram (posição das legendas entre 0.1 e 0.8).
- Sem música: ela entra no próprio Instagram. Sons curtos sim (`sfx` nas palavras).
- Nunca apague o vídeo original.
