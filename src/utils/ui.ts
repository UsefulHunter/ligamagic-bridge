/**
 * Utilitários compartilhados de UI para injeção de elementos nas páginas.
 */

import { buildLigaMagicUrl } from "./ligamagic";

const BUTTON_CLASS = "mtg-bridge-btn";
const STYLE_ID = "mtg-bridge-style";

const CSS = `
  .mtg-bridge-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #c8932a;
    color: #fff !important;
    border: none;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
    line-height: 1;
  }
  .mtg-bridge-btn:hover {
    background: #a87420;
    transform: translateY(-1px);
  }
  .mtg-bridge-btn:active {
    transform: translateY(0);
  }
  .mtg-bridge-btn svg {
    flex-shrink: 0;
  }
`;

const LIGA_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="7" cy="7" r="6" stroke="white" stroke-width="1.5"/>
  <path d="M4.5 9.5L7 4.5L9.5 9.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5.5 7.5H8.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/**
 * Injeta o botão "Ver na LigaMagic" em um elemento container.
 * Idempotente: remove o botão anterior se já existir.
 */
export function injectLigaMagicButton(
  container: Element,
  cardName: string
): HTMLAnchorElement {
  // Se já existe um botão NESTE container, remove antes de reinjetar
  container.querySelector(`.${BUTTON_CLASS}`)?.remove();

  // Injeta CSS uma única vez
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const url = buildLigaMagicUrl({ cardName });

  const btn = document.createElement("a");
  btn.className = BUTTON_CLASS;
  btn.href = url;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.title = `Buscar "${cardName}" na LigaMagic`;
  btn.innerHTML = `${LIGA_ICON} Ver na LigaMagic`;

  container.appendChild(btn);
  return btn;
}

/**
 * Remove o botão injetado, se existir.
 */
export function removeLigaMagicButton(): void {
  document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
}
