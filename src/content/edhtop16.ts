/**
 * Content script para decklists do EDHTop16.
 *
 * URL padrão: https://edhtop16.com/tournament/{torneio}/decklist/{id}
 *
 * Injeta o botão "Ver na LigaMagic" no painel de preview (lateral esquerda),
 * que acompanha a última carta sob o mouse.
 *
 * O EDHTop16 usa classes atômicas com hash (ex: "e16kpwil5"), então nos
 * apoiamos apenas em estrutura e atributos semânticos: o painel é o
 * <aside aria-label="Card preview">, com o nome no primeiro <div> de texto
 * logo após a imagem.
 */

import { injectLigaMagicButton } from "../utils/ui";
import { registerContextCardResolver } from "../utils/contextMenu";

const PREVIEW_SELECTOR = 'aside[aria-label="Card preview"]';

const PANEL_WRAPPER_CLASS = "mtg-bridge-edhtop16-panel";
const STYLE_ID = "mtg-bridge-edhtop16-style";

const CSS = `
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

function getPreviewCardName(preview: Element): string | null {
  const nameBlock = findPreviewNameBlock(preview);
  return nameBlock?.firstElementChild?.textContent?.trim() || null;
}

/** Nome da carta sob o cursor (menu de contexto): linha da lista ou preview */
function getContextCardName(target: Element): string | null {
  const row = target.closest<HTMLAnchorElement>(ROW_SELECTOR);
  if (row) return getRowCardName(row);

  const preview = target.closest(PREVIEW_SELECTOR);
  return preview ? getPreviewCardName(preview) : null;
}

function injectPanelButton(): void {
  const preview = document.querySelector(PREVIEW_SELECTOR);
  if (!preview) return;

  const nameBlock = findPreviewNameBlock(preview);
  const cardName = getPreviewCardName(preview);
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
  registerContextCardResolver(getContextCardName);
  tryInject();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
