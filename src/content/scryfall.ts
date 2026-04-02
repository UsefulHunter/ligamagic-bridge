/**
 * Content script para páginas de carta do Scryfall.
 *
 * URL padrão: https://scryfall.com/card/{set}/{num}/{card-name-slug}
 * Exemplo:    https://scryfall.com/card/c13/177/baleful-strix
 *
 * Estratégia:
 *   1. Extrai o nome canônico da carta do <h1> da página (mais confiável que a URL,
 *      pois a URL usa slug sem acentos e sem maiúsculas).
 *   2. Injeta o botão "Ver na LigaMagic" ao lado dos botões de ação existentes.
 */

import { injectLigaMagicButton } from "../utils/ui";

function getCardName(): string | null {
  // Tenta o h1 principal da página de carta individual
  const h1 = document.querySelector<HTMLElement>(
    "h1.card-text-title, .card-text-title"
  );
  if (h1) {
    // O <h1> contém filhos como <abbr class="card-text-mana-cost">{3}{R}</abbr>.
    // Precisamos só do texto do nome, ignorando o custo de mana.
    const manaCost = h1.querySelector(".card-text-mana-cost");
    if (manaCost) {
      // Clona o nó, remove o custo de mana, e pega o texto restante
      const clone = h1.cloneNode(true) as HTMLElement;
      clone.querySelector(".card-text-mana-cost")?.remove();
      const name = clone.textContent?.trim();
      if (name) return name;
    }
    // Fallback: se não achar mana cost separado, usa o texto direto
    const text = h1.textContent?.trim();
    if (text) return text;
  }

  // Fallback: extrai da URL (menos preciso para cartas com caracteres especiais)
  const match = window.location.pathname.match(/^\/card\/[^/]+\/[^/]+\/(.+)$/);
  if (match) {
    // Converte slug kebab-case → nome com espaços e capitaliza
    return match[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return null;
}

function findButtonContainer(): Element | null {
  // Barra de ações abaixo dos detalhes da carta (área com "Add to collection", etc.)
  const selectors = [
    ".card-actions",
    ".prints-current-set-details",
    ".card-legality-toggle", // fallback
    ".card-text",            // último recurso
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function init(): void {
  const cardName = getCardName();
  if (!cardName) return;

  const container = findButtonContainer();
  if (!container) {
    // Se não achar container ideal, injeta após o título
    const title = document.querySelector(".card-text-title");
    if (title?.parentElement) {
      injectLigaMagicButton(title.parentElement, cardName);
    }
    return;
  }

  injectLigaMagicButton(container, cardName);
}

// Aguarda o DOM estar pronto (content script roda em document_idle, mas por segurança)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
