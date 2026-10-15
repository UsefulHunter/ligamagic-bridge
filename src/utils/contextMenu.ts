/**
 * Ponte entre os content scripts e o menu de contexto do service worker.
 *
 * Cada content script registra um resolvedor que, dado o elemento clicado
 * com o botão direito, retorna o nome da carta. O nome fica guardado até o
 * service worker pedi-lo, no clique em "Ver na LigaMagic".
 */

export const GET_CONTEXT_CARD = "mtg-bridge:get-context-card";

export interface ContextCardResponse {
  cardName: string | null;
}

export function registerContextCardResolver(
  resolve: (target: Element) => string | null
): void {
  let lastCardName: string | null = null;

  document.addEventListener(
    "contextmenu",
    (e) => {
      try {
        lastCardName = e.target instanceof Element ? resolve(e.target) : null;
      } catch (_) {
        lastCardName = null;
      }
    },
    // Captura: registra antes de qualquer handler da página
    true
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== GET_CONTEXT_CARD) return;
    sendResponse({ cardName: lastCardName } satisfies ContextCardResponse);
  });
}
