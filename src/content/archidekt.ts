/**
 * Content script para páginas de deck do Archidekt.
 *
 * Injeta um link para a LigaMagic na barra de preços de cada carta,
 * ao lado dos links de Card Kingdom e TCGplayer.
 *
 * O nome da carta é extraído do link do Card Kingdom (parâmetro filter[name])
 * ou do alt text da imagem da carta (fallback).
 *
 * O Archidekt é uma SPA React, então usamos MutationObserver para
 * detectar cartas renderizadas dinamicamente.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";

const LINK_CLASS = "mtg-bridge-archidekt-link";
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
