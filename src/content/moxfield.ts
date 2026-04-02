/**
 * Content script para páginas do Moxfield.
 *
 * O Moxfield é uma SPA (React), então:
 *  - A URL muda sem reload completo (History API)
 *  - Os elementos do DOM são injetados/removidos dinamicamente
 *
 * Estratégias para detectar a carta atual:
 *  1. Sidebar: extrai o hash da imagem exibida e busca o nome via data-hash no deck list
 *  2. Modal "View Details": busca o nome no h1.mb-0 a
 *
 * O MutationObserver monitora mudanças no DOM para reinjetar o botão
 * sempre que o usuário navegar para uma carta diferente.
 */

import { injectLigaMagicButton, removeLigaMagicButton } from "../utils/ui";
import { buildLigaMagicUrl } from "../utils/ligamagic";

/** Seletor do container dos botões de compra (Buy @ TCGplayer, etc.) */
const BUY_BUTTONS_SELECTOR = ".d-grid.gap-2.mt-4.mx-auto";

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Determina o nome da carta correto para um container de botões de compra,
 * analisando o contexto DOM onde o container se encontra.
 */
function getNameForContainer(container: Element): string | null {
  // 1. Sidebar: o container está dentro de <aside> / .deckview-image-container
  //    Extrai o hash da imagem exibida e busca o nome correspondente no deck list
  const sidebar = container.closest("aside, .deckview-image-container");
  if (sidebar) {
    const img = sidebar.querySelector<HTMLImageElement>("img.deckview-image");
    if (img?.src) {
      const match = img.src.match(/\/card-([A-Za-z0-9]+)-/);
      if (match) {
        const hash = match[1];
        const nameEl = document.querySelector<HTMLElement>(
          `[data-hash="${hash}"] .decklist-card-phantomsearch`
        );
        if (nameEl?.textContent?.trim()) return nameEl.textContent.trim();
      }
    }
    return null;
  }

  // 2. Modal / outros contextos: sobe no DOM até achar um h1.mb-0 a com o nome
  let scope: Element | null = container.parentElement;
  while (scope && scope !== document.body) {
    const h1Link = scope.querySelector<HTMLElement>("h1.mb-0 a");
    if (h1Link?.textContent?.trim()) return h1Link.textContent.trim();
    scope = scope.parentElement;
  }

  return null;
}

/**
 * Injeta o botão em TODOS os containers de compra visíveis.
 * Para cada container, determina o nome da carta correto de forma independente.
 */
function tryInject(): void {
  // 1. Deck page: sidebar e modal (containers com .mt-4.mx-auto)
  const deckContainers = document.querySelectorAll(BUY_BUTTONS_SELECTOR);
  deckContainers.forEach((container) => {
    const cardName = getNameForContainer(container);
    if (!cardName) return;

    const existingBtn = container.querySelector<HTMLAnchorElement>(".mtg-bridge-btn");
    if (existingBtn?.title === `Buscar "${cardName}" na LigaMagic`) return;

    injectLigaMagicButton(container, cardName);
  });

  // 2. Dropdown (right-click context menu)
  tryInjectDropdown();

  // 3. Card detail page (/cards/*)
  tryInjectCardPage();
}

/**
 * Injeta o link "Ver na LigaMagic" no dropdown (menu de contexto) de uma carta.
 * O nome é obtido via data-hash presente no link "Flip Card Image".
 */
function tryInjectDropdown(): void {
  const dropdown = document.querySelector<HTMLElement>(
    ".dropdown-menu.show.dropdown-menu-isolate"
  );
  if (!dropdown) return;

  // Já injetado neste dropdown?
  if (dropdown.querySelector(".mtg-bridge-dropdown-item")) return;

  let cardName: string | null = null;

  // 1. Tenta via data-hash no link "Flip Card Image" (cartas de duas faces)
  const flipLink = dropdown.querySelector<HTMLElement>("a[data-hash]");
  const flipHash = flipLink?.dataset.hash;
  if (flipHash) {
    const nameEl = document.querySelector<HTMLElement>(
      `[data-hash="${flipHash}"] .decklist-card-phantomsearch`
    );
    cardName = nameEl?.textContent?.trim() ?? null;
  }

  // 2. Fallback: extrai o hash da imagem exibida na sidebar (funciona para todas as cartas)
  if (!cardName) {
    const sidebarImg = document.querySelector<HTMLImageElement>(
      "aside img.deckview-image, .deckview-image-container img.deckview-image"
    );
    if (sidebarImg?.src) {
      const match = sidebarImg.src.match(/\/card-([A-Za-z0-9]+)-/);
      if (match) {
        const nameEl = document.querySelector<HTMLElement>(
          `[data-hash="${match[1]}"] .decklist-card-phantomsearch`
        );
        cardName = nameEl?.textContent?.trim() ?? null;
      }
    }
  }

  if (!cardName) return;

  // Localiza a coluna esquerda do dropdown
  const leftColumn = dropdown.querySelector<HTMLElement>(
    ".d-inline-block:not(.dropdown-column-divider)"
  );
  if (!leftColumn) return;

  // Encontra o link "Add to Collection"
  const items = leftColumn.querySelectorAll<HTMLElement>("a.dropdown-item");
  let addToCollectionLink: HTMLElement | null = null;
  for (const item of Array.from(items)) {
    if (item.textContent?.trim() === "Add to Collection") {
      addToCollectionLink = item;
      break;
    }
  }
  if (!addToCollectionLink) return;

  // Cria divisor + link
  const divider = document.createElement("div");
  divider.className = "dropdown-divider";

  const url = buildLigaMagicUrl({ cardName });
  const link = document.createElement("a");
  link.className = "dropdown-item mtg-bridge-dropdown-item";
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Ver na LigaMagic";

  // Insere após "Add to Collection"
  addToCollectionLink.after(divider, link);
}

/**
 * Injeta o botão na página de detalhes de uma carta individual (/cards/*).
 * O nome vem do h1.mb-0 e o botão é adicionado junto aos links de compra.
 */
function tryInjectCardPage(): void {
  if (!window.location.pathname.startsWith("/cards/")) return;

  const h1 = document.querySelector<HTMLElement>("h1.mb-0");
  const cardName = h1?.textContent?.trim();
  if (!cardName) return;

  // Procura o .d-grid.gap-2 que contém links de compra (Card Kingdom, TCGplayer)
  const grids = document.querySelectorAll<HTMLElement>(".d-grid.gap-2");
  for (const grid of Array.from(grids)) {
    // Pula containers do deck page (já tratados acima)
    if (grid.matches(BUY_BUTTONS_SELECTOR)) continue;

    const hasBuyLinks = grid.querySelector(
      'a[href*="cardkingdom"], a[href*="tcgplayer"], a[href*="manapool"]'
    );
    if (!hasBuyLinks) continue;

    const existingBtn = grid.querySelector<HTMLAnchorElement>(".mtg-bridge-btn");
    if (existingBtn?.title === `Buscar "${cardName}" na LigaMagic`) return;

    injectLigaMagicButton(grid, cardName);
    return; // Injeta em apenas um container de compra
  }
}

function debouncedTryInject(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try { tryInject(); } catch (_) { /* não quebrar a página host */ }
  }, 10);
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
 * Monitora mudanças de URL em SPAs (pushState / replaceState / popstate).
 * Quando a rota muda, limpa botões e tenta injetar novamente.
 */
function watchNavigation(): void {
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPush(...args);
    setTimeout(() => { removeLigaMagicButton(); tryInject(); }, 300);
  };

  history.replaceState = (...args) => {
    originalReplace(...args);
    setTimeout(() => { removeLigaMagicButton(); tryInject(); }, 300);
  };

  window.addEventListener("popstate", () => {
    setTimeout(() => { removeLigaMagicButton(); tryInject(); }, 300);
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
