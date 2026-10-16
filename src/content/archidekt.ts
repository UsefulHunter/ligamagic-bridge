/**
 * Content script para páginas de deck do Archidekt.
 *
 * Injeta um link para a LigaMagic na barra de preços de cada carta,
 * ao lado dos links de Card Kingdom e TCGplayer.
 *
 * O nome da carta é extraído do link do Card Kingdom (parâmetro filter[name])
 * ou do alt text da imagem da carta (fallback).
 *
 * Também adiciona "Ver na LigaMagic" ao menu próprio que o Archidekt abre no
 * clique direito de uma carta (ele substitui o menu nativo do navegador).
 *
 * O Archidekt é uma SPA React, então usamos MutationObserver para
 * detectar cartas renderizadas dinamicamente.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";

const LINK_CLASS = "mtg-bridge-archidekt-link";
const MENU_ITEM_CLASS = "mtg-bridge-archidekt-menu-item";
const STYLE_ID = "mtg-bridge-archidekt-style";
const ICON_URL = chrome.runtime.getURL("icons/icon48.png");

const CSS = `
  .${LINK_CLASS} {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    text-decoration: none;
    white-space: nowrap;
    font-size: inherit;
    color: #ff5a00 !important;
    transition: opacity 0.15s;
  }
  .${LINK_CLASS}:hover {
    opacity: 0.8;
  }
  .${LINK_CLASS} img {
    height: 1em;
    width: 1em;
    border-radius: 2px;
    vertical-align: middle;
  }
  /* Mesmo tamanho/espaçamento dos ícones SVG dos itens nativos do menu */
  .${MENU_ITEM_CLASS} img {
    width: 14px;
    height: 14px;
    margin-right: 8px;
    border-radius: 2px;
    vertical-align: -2px;
  }
`;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Card name extraction
// ---------------------------------------------------------------------------

/**
 * Extrai o nome da carta a partir do link do Card Kingdom dentro do price container.
 * O Card Kingdom usa o parâmetro `filter[name]=Card Name` na URL.
 */
function getCardNameFromCKLink(priceContainer: Element): string | null {
  const ckLink = priceContainer.querySelector<HTMLAnchorElement>(
    'a[href*="cardkingdom.com"]'
  );
  if (!ckLink) return null;

  try {
    const url = new URL(ckLink.href);
    const name = url.searchParams.get("filter[name]");
    if (name?.trim()) return name.trim();
  } catch {
    // URL inválida, tenta fallback
  }

  return null;
}

/**
 * Extrai o nome da carta a partir do alt text da imagem.
 * O alt text tem formato "Card Name (set) number" — removemos o sufixo.
 */
function getCardNameFromImage(card: Element): string | null {
  const img = card.querySelector<HTMLImageElement>(
    'img[id="basicCardImage"], img[class*="basicCard_image"]'
  );
  if (!img?.alt?.trim()) return null;

  // Remove sufixo como "(fin) 90", "(mh3) 123", etc.
  const raw = img.alt.trim();
  return raw.replace(/\s*\([^)]*\)\s*\d*\s*$/, "").trim() || null;
}

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

function injectCSS(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * Injeta o link da LigaMagic em todos os price containers visíveis.
 */
function tryInject(): void {
  const priceContainers = document.querySelectorAll<HTMLElement>(
    '[class*="prices_container"]'
  );

  if (priceContainers.length === 0) return;

  injectCSS();

  priceContainers.forEach((container) => {
    // Já injetado neste container?
    if (container.querySelector(`.${LINK_CLASS}`)) return;

    // Extrair nome da carta
    const cardName =
      getCardNameFromCKLink(container) ??
      getCardNameFromImage(
        container.closest('[class*="imageCard_imageCard"]') ??
          container.closest('[class*="basicCard_container"]') ??
          container.parentElement?.parentElement ??
          container
      );

    if (!cardName) return;

    const url = buildLigaMagicUrl({ cardName });

    const link = document.createElement("a");
    link.className = `${LINK_CLASS}`;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `Buscar "${cardName}" na LigaMagic`;
    link.setAttribute("aria-label", `Buscar "${cardName}" na LigaMagic`);
    link.innerHTML = `<img src="${ICON_URL}" alt="LigaMagic"> LigaMagic`;

    // Adiciona como terceira coluna, após os links existentes
    container.appendChild(link);
  });
}

/**
 * Injeta "Ver na LigaMagic" no menu de contexto próprio do Archidekt, logo
 * após "View card page". O nome vem do cabeçalho do menu, e o item reaproveita
 * a estrutura do link "View card page" (ícone + texto) para herdar o estilo.
 */
function tryInjectContextMenu(): void {
  const menu = document.querySelector('[class*="contextMenu_menuInterior"]');
  if (!menu) return;

  const cardName = menu
    .querySelector('[class*="menu_header"]')
    ?.textContent?.trim();
  if (!cardName) return;

  const existing = menu.querySelector<HTMLAnchorElement>(`.${MENU_ITEM_CLASS}`);
  if (existing?.title === `Buscar "${cardName}" na LigaMagic`) return;
  existing?.remove();

  injectCSS();

  const item = document.createElement("a");
  item.className = MENU_ITEM_CLASS;
  item.href = buildLigaMagicUrl({ cardName });
  item.target = "_blank";
  item.rel = "noopener noreferrer";
  item.title = `Buscar "${cardName}" na LigaMagic`;
  item.innerHTML = `<img src="${ICON_URL}" alt="">Ver na LigaMagic`;

  // Os itens nativos fecham o menu ao clicar; o Archidekt fecha com Escape.
  // Despacha depois do clique para não interferir na abertura da nova aba.
  item.addEventListener("click", () => {
    setTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true })
      );
    }, 0);
  });

  // Após "View card page" (único <a> do menu); senão, ao final dos itens
  const anchor = menu.querySelector(`a:not(.${MENU_ITEM_CLASS})`);
  const lastButton = Array.from(menu.querySelectorAll("button")).pop();
  const ref = anchor ?? lastButton;
  if (ref) ref.after(item);
  else menu.appendChild(item);
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

  // O menu de contexto aparece no clique direito: reage sem o debounce longo
  try {
    tryInjectContextMenu();
  } catch (_) {
    /* não quebrar a página host */
  }
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
