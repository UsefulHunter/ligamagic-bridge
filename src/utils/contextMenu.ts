/**
 * Ponte entre os content scripts e o menu de contexto do service worker.
 *
 * Cada content script registra um resolvedor que, dado o elemento clicado
 * com o botão direito, retorna o nome da carta. O nome é gravado num atributo
 * do <html>, que o service worker lê via chrome.scripting no clique em
 * "Ver na LigaMagic".
 *
 * Usamos o DOM em vez de chrome.runtime messaging porque, após recarregar ou
 * atualizar a extensão, os content scripts das abas já abertas ficam órfãos:
 * continuam rodando e mexendo no DOM, mas não recebem mais mensagens.
 */

export const CONTEXT_CARD_ATTR = "data-mtg-bridge-context-card";

export function registerContextCardResolver(
  resolve: (target: Element) => string | null
): void {
  document.addEventListener(
    "contextmenu",
    (e) => {
      let cardName: string | null = null;
      try {
        cardName = e.target instanceof Element ? resolve(e.target) : null;
      } catch (_) {
        /* não quebrar a página host */
      }

      const root = document.documentElement;
      if (cardName) root.setAttribute(CONTEXT_CARD_ATTR, cardName);
      else root.removeAttribute(CONTEXT_CARD_ATTR);
    },
    // Captura: registra antes de qualquer handler da página
    true
  );
}
