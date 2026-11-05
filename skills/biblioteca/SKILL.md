---
name: biblioteca
description: Catálogo dos efeitos de motion do Essence Studio com o id de cada um, para usar em project.json. Use quando o usuário pedir um efeito pelo nome ("celular", "zoom de impacto", "polaroid", "número contando"), descrever uma animação, ou colar um pedido copiado da Biblioteca de efeitos.
---

# Biblioteca de efeitos

O código de cada efeito está em `src/effects/library/*.tsx` (campos editáveis em `fields`). Use o `id` em `effects[].effectId` e preencha `props` só com o que o usuário pediu.

| Categoria | id: nome |
|---|---|
| Cards e interface | `phone-mockup`: Celular · `checklist`: Checklist · `ui-world`: Mundo de app · `chat-messages`: Mensagens · `frame-break`: Moldura de post · `a-vs-b`: A vs B |
| Câmera e vídeo | `punch-zoom`: Zoom de impacto · `digital-zoom`: Zoom digital P&B · `vertigo`: Vertigo · `pull-back-reveal`: Grade de clipes · `reels-carousel`: Carrossel 3D · `glass-type`: Letreiro de vidro · `cover-story`: Capa de revista |
| Texto | `animated-title`: Título animado (entradas: fade, slide, pop, scale, blur, stagger, overshoot, bounce, elastic) · `typewriter`: Máquina de escrever · `marker-highlight`: Marca-texto · `circle-word`: Círculo à mão · `strike-word`: Riscar · `text-swap`: Trocar a palavra · `ticker`: Letreiro rolando · `mask-reveal`: Revelar por máscara · `glitch-word`: Glitch · `lower-third`: Nome na tela |
| Números e gráficos | `count-up`: Número contando · `glass-graph`: Gráfico de vidro · `chart-grow`: Barras crescendo · `slot-machine`: Caça-níquel · `match-cut`: Match cut · `progress-slider`: Barra de progresso · `stat-card`: Card de resultado |
| Adesivos e colagem | `headline-wall`: Post-its · `polaroid-orbit`: Polaroid em órbita · `polaroid-stack`: Polaroids · `doodles`: Rabiscos · `paper-frame`: Papel picotado · `speech-bubble`: Balão |
| Transições | `zoom-through`: Zoom através · `wipe`: Cortina · `flash`: Flash |

Pedido vago ("deixa mais dinâmico")? Não invente: proponha 2 ou 3 efeitos pelo nome e diga em que palavra entrariam.
