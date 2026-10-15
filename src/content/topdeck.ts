/**
 * Content script para decklists do TopDeck.gg.
 *
 * URL padrão: https://topdeck.gg/deck/{evento}/{id}
 *
 * No TopDeck.gg cada carta da lista é um link para o TCGplayer, tanto na
 * visualização em grade (<a><img alt="Nome"></a>) quanto em texto
 * (<a><span>1</span><span>Nome</span></a>). Em vez de injetar botões,
 * reescrevemos o href desses links para a busca da LigaMagic: o clique
 * (normal, do meio ou com Ctrl) e a barra de status passam a apontar para
 * a LigaMagic.
 *
 * O site usa Tailwind, sem classes semânticas; por isso nos apoiamos apenas
 * no domínio do link.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";
import { registerContextCardResolver } from "../utils/contextMenu";

const CARD_LINK_SELECTOR = 'a[href*="tcgplayer"]';
const REWRITTEN_ATTR = "data-mtg-bridge-card";

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const QUANTITY_REGEX = /^\d+x?$/;

/**
 * Nome da carta de um link: alt da imagem (grade) ou, na visualização em
 * texto, o primeiro <span> que não seja a quantidade
 * (<span>1</span><span>Phyrexian Walker</span>).
 */
function getLinkCardName(link: HTMLAnchorElement): string | null {
  const alt = link.querySelector("img[alt]")?.getAttribute("alt")?.trim();
  if (alt) return alt;

  for (const span of Array.from(link.querySelectorAll("span"))) {
    const text = span.textContent?.trim();
    if (text && !QUANTITY_REGEX.test(text)) return text;
  }

  return null;
}

function rewriteLinks(): void {
  document
    .querySelectorAll<HTMLAnchorElement>(CARD_LINK_SELECTOR)
    .forEach((link) => {
      const cardName = getLinkCardName(link);
      if (!cardName) return;

      link.href = buildLigaMagicUrl({ cardName });
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = `Buscar "${cardName}" na LigaMagic`;
      link.setAttribute(REWRITTEN_ATTR, cardName);
    });
}

function getContextCardName(target: Element): string | null {
  const link = target.closest<HTMLAnchorElement>(
    `${CARD_LINK_SELECTOR}, a[${REWRITTEN_ATTR}]`
  );
  return link?.getAttribute(REWRITTEN_ATTR) ?? (link && getLinkCardName(link));
}

function debouncedRewrite(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    try {
      rewriteLinks();
    } catch (_) {
      /* não quebrar a página host */
    }
  }, 50);
}

function startObserver(): void {
  if (observer) observer.disconnect();

  // Troca de visualização (grade/texto) re-renderiza a lista; um re-render do
  // React também pode restaurar o href original, por isso observamos "href".
  observer = new MutationObserver(debouncedRewrite);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
}

function init(): void {
  registerContextCardResolver(getContextCardName);
  rewriteLinks();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
