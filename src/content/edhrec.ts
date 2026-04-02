/**
 * Content script para páginas do EDHREC.
 *
 * Injeta um botão "LigaMagic" na barra de links externos (OutboundBar),
 * ao lado de Cardsphere, Archidekt, Moxfield, Scryfall, etc.
 *
 * Estratégias para extrair o nome da carta:
 *   1. Alt text da imagem principal da carta (mais confiável)
 *   2. Texto do <h3> no cabeçalho, removendo sufixos como "(Commander)"
 *
 * O EDHREC é uma SPA Next.js com CSS Modules (classes com hash),
 * então usamos seletores com prefixo [class*="..."] para robustez.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";

const BUTTON_CLASS = "mtg-bridge-edhrec-btn";
const STYLE_ID = "mtg-bridge-edhrec-style";

/** CSS que replica o estilo dos botões da OutboundBar do EDHREC */
const CSS = `
  .${BUTTON_CLASS} {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 4px;
    background: #c8932a;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: filter 0.15s;
  }
  .${BUTTON_CLASS}:hover {
    filter: brightness(1.15);
  }
  .${BUTTON_CLASS} img,
  .${BUTTON_CLASS} svg {
    height: 20px;
    width: auto;
  }
`;

/** Ícone SVG minimalista para LigaMagic (estilo similar aos outros ícones) */
const LIGA_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="10" cy="10" r="8.5" stroke="white" stroke-width="1.5" fill="none"/>
  <text x="10" y="14.5" text-anchor="middle" font-size="12" font-weight="700"
        font-family="Arial, sans-serif" fill="white">L</text>
</svg>`;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Card name extraction
// ---------------------------------------------------------------------------

/**
 * Extrai o nome da carta a partir da imagem principal (atributo alt).
 * Mais confiável que o h3, pois não inclui sufixos como "(Commander)".
 */
function getCardNameFromImage(): string | null {
  // A imagem de carta no EDHREC usa classes com prefixo "CardImage_"
  const img = document.querySelector<HTMLImageElement>(
    'img[class*="CardImage_"][alt]'
  );
  if (img?.alt?.trim()) return img.alt.trim();

  // Fallback: qualquer imagem com src de cards.scryfall.io
  const scryfallImg = document.querySelector<HTMLImageElement>(
    'img[src*="cards.scryfall.io"][alt]'
  );
  if (scryfallImg?.alt?.trim()) return scryfallImg.alt.trim();

  return null;
}

/**
 * Extrai o nome da carta do cabeçalho <h3>, removendo sufixos entre parênteses.
 * Ex: "The Ur-Dragon (Commander)" → "The Ur-Dragon"
 */
function getCardNameFromHeader(): string | null {
  // O header usa classes com prefixo "CoolHeader_"
  const h3 = document.querySelector<HTMLElement>(
    'h3, [class*="CoolHeader_"] h3'
  );
  if (!h3?.textContent) return null;

  // Remove sufixo entre parênteses: "(Commander)", "(Card)", etc.
  const raw = h3.textContent.trim();
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim() || null;
}

/**
 * Retorna o nome da carta da página atual, tentando múltiplas estratégias.
 */
function getCardName(): string | null {
  return getCardNameFromImage() ?? getCardNameFromHeader();
}

// ---------------------------------------------------------------------------
// OutboundBar detection & injection
// ---------------------------------------------------------------------------

/**
 * Localiza o container da OutboundBar (barra com links para sites externos).
 * Tenta por classe CSS com prefixo, depois por heurística de links.
 */
function findOutboundBar(): Element | null {
  // 1. Seletor por prefixo de classe (CSS Modules do EDHREC)
  const bar = document.querySelector('[class*="OutboundBar_container"]');
  if (bar) return bar;

  // 2. Heurística: container que possui links para sites externos conhecidos
  const knownHrefs = [
    "cardsphere.com",
    "archidekt.com",
    "commanderspellbook.com",
    "moxfield.com",
  ];
  const allLinks = document.querySelectorAll<HTMLAnchorElement>("a[href]");
  for (const link of Array.from(allLinks)) {
    if (knownHrefs.some((domain) => link.href.includes(domain))) {
      // Sobe até o container que agrupa todos os botões
      let parent = link.parentElement;
      while (parent && parent !== document.body) {
        // Verifica se este container tem múltiplos links externos
        const childLinks = parent.querySelectorAll("a[target='_blank']");
        if (childLinks.length >= 3) return parent;
        parent = parent.parentElement;
      }
    }
  }

  return null;
}

/**
 * Encontra o wrapper de um botão existente na outbound bar para clonar a estrutura.
 * Retorna o primeiro div wrapper filho (ex: div.OutboundBar_button__*).
 */
function findButtonWrapper(bar: Element): Element | null {
  return bar.querySelector('[class*="OutboundBar_button"]');
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
  existing?.parentElement?.remove();

  injectCSS();

  const url = buildLigaMagicUrl({ cardName });

  // Cria o link com estilo compatível
  const link = document.createElement("a");
  link.className = `btn ${BUTTON_CLASS}`;
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = `Buscar "${cardName}" na LigaMagic`;
  link.innerHTML = LIGA_ICON_SVG;

  // Cria wrapper div para consistência com a estrutura existente
  const wrapper = document.createElement("div");

  // Tenta copiar a classe do wrapper existente para manter a mesma aparência
  const existingWrapper = findButtonWrapper(bar);
  if (existingWrapper) {
    wrapper.className = existingWrapper.className;
  }

  wrapper.appendChild(link);

  // Insere como primeiro filho (à esquerda de Cardsphere)
  bar.insertBefore(wrapper, bar.firstChild);
}

// ---------------------------------------------------------------------------
// Observer & navigation
// ---------------------------------------------------------------------------

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

  observer = new MutationObserver(debouncedTryInject);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Monitora mudanças de URL na SPA do EDHREC (Next.js usa client-side navigation).
 */
function watchNavigation(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPush(...args);
    setTimeout(debouncedTryInject, 500);
  };

  history.replaceState = (...args) => {
    originalReplace(...args);
    setTimeout(debouncedTryInject, 500);
  };

  window.addEventListener("popstate", () => {
    setTimeout(debouncedTryInject, 500);
  });
}

function init(): void {
  tryInject();
  startObserver();
  watchNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
