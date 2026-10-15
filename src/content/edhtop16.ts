/**
 * Content script para decklists do EDHTop16.
 *
 * URL padrão: https://edhtop16.com/tournament/{torneio}/decklist/{id}
 *
 * Dois pontos de entrada para a LigaMagic:
 *   1. Ícone em cada linha da lista, visível apenas no hover da linha.
 *   2. Botão no painel de preview (lateral esquerda), que acompanha a última
 *      carta sob o mouse.
 *
 * O EDHTop16 usa classes atômicas com hash (ex: "e16kpwil5"), então nos
 * apoiamos apenas em estrutura e atributos semânticos:
 *   - Linhas: <a href="https://manapool.com/card/..."><span>Nome</span>...</a>
 *   - Painel: <aside aria-label="Card preview">, com o nome no primeiro <div>
 *     de texto logo após a imagem.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";
import { injectLigaMagicButton } from "../utils/ui";

const ROW_SELECTOR = 'a[href*="manapool.com/card/"]';
const PREVIEW_SELECTOR = 'aside[aria-label="Card preview"]';

const ROW_ICON_CLASS = "mtg-bridge-edhtop16-icon";
const PANEL_WRAPPER_CLASS = "mtg-bridge-edhtop16-panel";
const STYLE_ID = "mtg-bridge-edhtop16-style";
const ICON_URL = chrome.runtime.getURL("icons/icon48.png");

const CSS = `
  .${ROW_ICON_CLASS} {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: 6px;
    cursor: pointer;
    visibility: hidden;
    transition: transform 0.1s;
  }
  ${ROW_SELECTOR}:hover .${ROW_ICON_CLASS} {
    visibility: visible;
  }
  .${ROW_ICON_CLASS}:hover {
    transform: scale(1.15);
  }
  .${ROW_ICON_CLASS} img {
    width: 16px;
    height: 16px;
    border-radius: 3px;
  }
  .${PANEL_WRAPPER_CLASS} {
    display: flex;
    margin: 12px 0;
  }
`;

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function injectCSS(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Ícone por linha
// ---------------------------------------------------------------------------

function getRowCardName(row: HTMLAnchorElement): string | null {
  return row.querySelector("span")?.textContent?.trim() || null;
}

/**
 * Cria o ícone da linha. A linha inteira já é um <a> para a Mana Pool, e <a>
 * aninhado é HTML inválido; por isso o ícone é um <span role="link"> que
 * intercepta o clique e abre a LigaMagic no lugar da Mana Pool.
 */
function createRowIcon(cardName: string): HTMLSpanElement {
  const url = buildLigaMagicUrl({ cardName });

  const icon = document.createElement("span");
  icon.className = ROW_ICON_CLASS;
  icon.setAttribute("role", "link");
  icon.title = `Buscar "${cardName}" na LigaMagic`;
  icon.innerHTML = `<img src="${ICON_URL}" alt="LigaMagic">`;

  const open = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };
  icon.addEventListener("click", open);
  // Clique do meio: evita que o browser abra o link da Mana Pool
  icon.addEventListener("auxclick", (e) => {
    if (e.button === 1) open(e);
  });

  return icon;
}

function injectRowIcons(): void {
  document.querySelectorAll<HTMLAnchorElement>(ROW_SELECTOR).forEach((row) => {
    const cardName = getRowCardName(row);
    if (!cardName) return;

    const existing = row.querySelector<HTMLElement>(`.${ROW_ICON_CLASS}`);
    if (existing?.title === `Buscar "${cardName}" na LigaMagic`) return;
    existing?.remove();

    row.appendChild(createRowIcon(cardName));
  });
}

// ---------------------------------------------------------------------------
// Botão no painel de preview
// ---------------------------------------------------------------------------

/**
 * O bloco de nome é o primeiro <div> após a imagem, com o nome e o tipo da
 * carta em dois <div> filhos.
 */
function findPreviewNameBlock(preview: Element): Element | null {
  const imgBlock = preview.querySelector("img")?.parentElement;
  const nameBlock = imgBlock?.nextElementSibling;
  return nameBlock?.tagName === "DIV" ? nameBlock : null;
}

function injectPanelButton(): void {
  const preview = document.querySelector(PREVIEW_SELECTOR);
  if (!preview) return;

  const nameBlock = findPreviewNameBlock(preview);
  const cardName = nameBlock?.firstElementChild?.textContent?.trim();
  if (!nameBlock || !cardName) return;

  let wrapper = preview.querySelector(`.${PANEL_WRAPPER_CLASS}`);
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = PANEL_WRAPPER_CLASS;
    nameBlock.after(wrapper);
  }

  const existing = wrapper.querySelector<HTMLAnchorElement>("a");
  if (existing?.title === `Buscar "${cardName}" na LigaMagic`) return;

  injectLigaMagicButton(wrapper, cardName);
}

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

function tryInject(): void {
  injectCSS();
  injectRowIcons();
  injectPanelButton();
}

function debouncedTryInject(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      tryInject();
    } catch (_) {
      /* não quebrar a página host */
    }
  }, 50);
}

function startObserver(): void {
  if (observer) observer.disconnect();

  // O preview troca o nome via characterData/childList no hover de cada linha
  observer = new MutationObserver(debouncedTryInject);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
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
