# Entrevista de marca

Roda uma vez, antes da primeira edição. Gera `~/.essence-studio/marca.json` (para o estúdio e o motor) e `~/.essence-studio/marca.md` (regras em texto, para você ler em toda edição).

## Como conduzir
- **Uma pergunta por vez**, em linguagem simples. Ofereça 2 a 4 opções concretas, mais "outra coisa".
- "Não sei"? Sugira a melhor opção pelo que a pessoa já contou e siga.
- No fim, mostre um resumo curto e pergunte "quer mudar algo?" antes de salvar.

## Perguntas
1. Sobre o que é o seu perfil e quem assiste? (uma frase cada)
2. Me mostre um Reel que você queria ter feito (link ou print). O que você gosta nele?
3. Cores da marca (hex, ou descreva: "rosa claro e preto"). Qual é a cor de destaque?
4. Cores ou estilos que você nunca quer.
5. Fontes: tem fontes da marca? Se não, ofereça 3 pares do Google Fonts que combinem.
6. Estilo das legendas: uma palavra por vez (grande, no meio) · frases curtas (2 a 4 palavras) · frase inteira. Destacar palavras-chave em outra cor? Maiúsculas?
7. Energia visual: limpo e minimalista (look Suave) · criativo e colagem (Colagem) · elegante e editorial (Editorial) · forte e direto (Manchete).
8. Quantidade de efeitos: poucos (1 a cada 8–12 s) · equilibrado (1 a cada 4–6 s, padrão) · muitos (1 a cada 2–4 s).
9. Sons: nenhum · sutis · bastante.
10. Ritmo: natural (só pausas longas saem) · rápido (quase todas as pausas saem).
11. Sua chamada para ação de sempre (ex.: "comenta GUIA que eu te mando").
12. Onde você posta: Instagram, TikTok, YouTube Shorts?

## marca.json
Campos que o estúdio e o motor entendem (todos opcionais):
```json
{
  "nome": "", "instagram": "@", "pastaVideos": "",
  "look": "soft | scrapbook | signature | headline",
  "style": { "colors": { "text": "#", "accent": "#", "background": "#", "secondary": "#" },
             "titleFont": "", "captionFont": "", "accentFont": "",
             "captionMode": "word | phrase | karaoke", "uppercase": false },
  "efeitos": "poucos | equilibrado | muitos",
  "sons": "nenhum | sutis | bastante",
  "ritmo": "natural | rapido",
  "cta": ""
}
```
As chaves das fontes são as de `src/core/fonts.ts` (ex.: `PlayfairDisplay`, `Inter`, `Fraunces`).

## Regras da marca
Se durante uma edição a pessoa corrigir algo ("nunca use contorno nas legendas"), anote na hora em `marca.md`, na seção "Regras", para a próxima edição já sair certa.
