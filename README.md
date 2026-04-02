# MTG Bridge 🃏

Extensão para Chrome/Brave que adiciona links rápidos para a **LigaMagic** em páginas do **Scryfall**, **Moxfield** e **EDHREC**.

## Como funciona

- **Scryfall** — Em qualquer página de carta (`scryfall.com/card/...`), um botão **"Ver na LigaMagic"** é injetado automaticamente.
- **Moxfield** — O botão aparece no painel de detalhes ao clicar em uma carta.
- **EDHREC** — Um ícone da LigaMagic é adicionado à barra de links externos (outbound bar) nas páginas de comandantes e cartas, ao lado de Cardsphere, Archidekt, etc.
- **Popup** — O popup da extensão (ícone na barra do browser) mostra a carta detectada na aba atual e permite abrir ou copiar o link.

## Setup (desenvolvimento)

### Pré-requisitos
- Node.js 18+
- Yarn

### Instalação

```bash
yarn install
```

### Build

```bash
# Build único (para produção)
yarn build

# Watch mode (desenvolvimento — recompila ao salvar)
yarn dev

# Checagem de tipos sem build
yarn typecheck
```

Os arquivos compilados ficam em `dist/`.

### Carregando a extensão no Chrome/Brave

1. Acesse `chrome://extensions` (ou `brave://extensions`)
2. Ative o **Modo de desenvolvedor** (canto superior direito)
3. Clique em **"Carregar sem compactação"**
4. Selecione a pasta `dist/`

A extensão aparecerá na barra do browser. Navegue até uma carta no Scryfall, Moxfield ou EDHREC para testar.

---

## Estrutura do projeto

```
mtg-bridge/
├── src/
│   ├── content/
│   │   ├── scryfall.ts     ← injeta botão nas páginas de carta do Scryfall
│   │   ├── moxfield.ts     ← observer SPA para o Moxfield
│   │   └── edhrec.ts       ← injeta ícone na outbound bar do EDHREC
│   ├── popup/
│   │   ├── popup.ts        ← lógica do popup
│   │   └── popup.html      ← interface do popup
│   └── utils/
│       ├── ligamagic.ts    ← geração de URLs da LigaMagic
│       └── ui.ts           ← injeção de botão compartilhada
├── public/
│   ├── manifest.json       ← manifest v3
│   └── icons/              ← ícones da extensão (a adicionar)
├── dist/                   ← saída do build (gerada automaticamente)
├── build.mjs               ← script de build (esbuild)
├── package.json
└── tsconfig.json
```

---

## Roadmap

### v0.1 (atual)
- [x] Scryfall: injeção de botão na página da carta
- [x] Moxfield: observer SPA + injeção de botão
- [x] EDHREC: ícone na outbound bar (comandantes e cartas)
- [x] Popup com nome da carta detectada + link + copiar
- [x] Encoding correto de nomes especiais (apóstrofos, barras `//`)

### v0.2 (próximos passos)
- [ ] Ícones da extensão (PNG 16/48/128)
- [ ] Testes unitários para `normalizeCardName` (casos edge)
- [ ] Suporte ao Gatherer (requer resolução de `multiverseid` → nome via API Scryfall)
- [ ] Tabela de mapeamento de edições (Scryfall code → LigaMagic code)

### v0.3 (futuro)
- [ ] Mostrar preço mínimo da carta no popup (requer scraping da LigaMagic)
- [ ] Suporte a múltiplas cartas de um deck (exportar lista para LigaMagic)
- [ ] Opção de abrir na mesma aba vs nova aba

---

## Notas técnicas

### Encoding de nomes de cartas
A LigaMagic aceita o parâmetro `card=` com espaços substituídos por `+` e caracteres especiais encodados via `encodeURIComponent`. Casos tratados:
- Apóstrofos: `Urza's Tower` → `Urza%27s+Tower`
- Barras (cartas divididas): `Fire // Ice` → usa apenas o lado A (`Fire`)
- Acentos: preservados (LigaMagic os aceita corretamente)

### Nomenclatura de edições
A LigaMagic usa códigos próprios que **nem sempre coincidem** com os do Scryfall. Na v0.1, a busca é feita **apenas pelo nome** da carta, o que retorna todas as edições disponíveis — suficiente para uso diário. O mapeamento de edições será implementado na v0.2.
