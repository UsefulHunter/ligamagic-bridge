/**
 * Content script para páginas do EDHREC.
 *
 * Injeta um botão "LigaMagic" na barra de links externos (OutboundBar),
 * ao lado de Cardsphere, Archidekt, Moxfield, Scryfall, etc.
 *
 * Layout atual (2026): a barra é uma <ul class="<hash>_list"> com um
 * <li><a class="<hash>_link <hash>_link--<site>"> por site, e o nome da
 * carta fica em <h1><span class="<hash>_headingMain">.
 *
 * O EDHREC usa CSS Modules com prefixo de hash que muda a cada deploy,
 * então os seletores se apoiam apenas nos sufixos estáveis das classes.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";

const BUTTON_CLASS = "mtg-bridge-edhrec-btn";
const STYLE_ID = "mtg-bridge-edhrec-style";

/** Sites conhecidos da barra, usados para localizá-la pelo modificador da classe */
const KNOWN_SITES = ["cardsphere", "archidekt", "moxfield", "scryfall"];

/** CSS que acompanha o estilo dos blocos da OutboundBar do EDHREC */
const CSS = `
  .${BUTTON_CLASS} {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 6px 4px;
    min-width: 40px;
    box-sizing: border-box;
    background: #ff5a00;
    cursor: pointer;
    text-decoration: none;
    transition: filter 0.15s;
  }
  .${BUTTON_CLASS}:hover {
    filter: brightness(1.15);
  }
  .${BUTTON_CLASS} img {
    height: 20px;
    width: 20px;
    border-radius: 3px;
  }
`;

const ICON_URL = chrome.runtime.getURL("icons/icon48.png");

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Card name extraction
// ---------------------------------------------------------------------------

/**
 * Extrai o nome da carta do cabeçalho <h1>, removendo sufixos entre parênteses.
 * Ex: "The Ur-Dragon (Commander)" → "The Ur-Dragon"
 */
function getCardName(): string | null {
  const heading =
    document.querySelector<HTMLElement>('h1 [class*="_headingMain"]') ??
    document.querySelector<HTMLElement>("h1");
  const raw = heading?.textContent?.trim();
  if (!raw) return null;

  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
}

// ---------------------------------------------------------------------------
// OutboundBar detection & injection
// ---------------------------------------------------------------------------

/**
 * Localiza a lista da OutboundBar a partir de um link com modificador de site
 * conhecido (ex: "<hash>_link--archidekt").
 */
function findOutboundBar(): HTMLUListElement | null {
  for (const site of KNOWN_SITES) {
    const link = document.querySelector(`ul a[class*="_link--${site}"]`);
    const list = link?.closest("ul");
    if (list) return list;
  }
  return null;
}

function injectCSS(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Injeta o botão LigaMagic na OutboundBar.
 */
function tryInject(): void {
  const cardName = getCardName();
  if (!cardName) return;

  const bar = findOutboundBar();
  if (!bar) return;

  // Já injetado para esta carta?
  const existing = bar.querySelector<HTMLAnchorElement>(`.${BUTTON_CLASS}`);
  if (existing?.title === `Buscar "${cardName}" na LigaMagic`) return;

  // Remove botão anterior (caso a carta tenha mudado)
  existing?.closest("li")?.remove();

  injectCSS();

  const link = document.createElement("a");
  link.className = BUTTON_CLASS;
  link.href = buildLigaMagicUrl({ cardName });
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = `Buscar "${cardName}" na LigaMagic`;
  link.innerHTML = `<img src="${ICON_URL}" alt="LigaMagic">`;

  // Reaproveita a classe base dos links da barra (ex: "<hash>_link") para
  // herdar dimensões; o modificador de site fica de fora.
  const baseClass = bar
    .querySelector("a")
    ?.className.split(/\s+/)
    .find((c) => c.endsWith("_link"));
  if (baseClass) link.classList.add(baseClass);

  const item = document.createElement("li");
  item.appendChild(link);

  // Insere como primeiro item (à esquerda de Cardsphere)
  bar.insertBefore(item, bar.firstChild);
}

// ---------------------------------------------------------------------------
// Observer & navigation
// ---------------------------------------------------------------------------

let lastUrl = location.href;

function debouncedTryInject(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      tryInject();
    } catch (_) {
      /* não quebrar a página host */
    }
  }, 200);
}

function startObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
    debouncedTryInject();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function init(): void {
  tryInject();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
