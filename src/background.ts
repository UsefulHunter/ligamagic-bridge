/**
 * Service worker da extensão: itens no menu de contexto (clique direito).
 *
 *   - "Ver na LigaMagic": nos sites suportados, abre a carta sob o cursor.
 *     O título é fixo porque o Chrome monta o menu antes de o content script
 *     conseguir atualizá-lo; a carta é resolvida só no clique, pedindo ao
 *     content script da aba o nome registrado no último "contextmenu".
 *     Moxfield e Archidekt ficam de fora: eles substituem o menu nativo nas
 *     cartas por um menu próprio.
 *
 *   - "Buscar '%s' na LigaMagic": em qualquer site, busca o texto selecionado.
 */

import { buildLigaMagicUrl } from "./utils/ligamagic";
import { GET_CONTEXT_CARD, type ContextCardResponse } from "./utils/contextMenu";

const MENU_CARD = "mtg-bridge-card";
const MENU_SELECTION = "mtg-bridge-selection";

const CARD_SITES = [
  "https://scryfall.com/*",
  "https://edhrec.com/*",
  "https://edhtop16.com/*",
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_CARD,
      title: "Ver na LigaMagic",
      contexts: ["page", "link", "image"],
      documentUrlPatterns: CARD_SITES,
    });
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: 'Buscar "%s" na LigaMagic',
      contexts: ["selection"],
    });
  });
});

function openLigaMagic(cardName: string, tab?: chrome.tabs.Tab): void {
  chrome.tabs.create({
    url: buildLigaMagicUrl({ cardName }),
    ...(tab?.index !== undefined && { index: tab.index + 1 }),
    ...(tab?.windowId !== undefined && { windowId: tab.windowId }),
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === MENU_SELECTION) {
    const text = info.selectionText?.trim();
    if (text) openLigaMagic(text, tab);
    return;
  }

  if (info.menuItemId === MENU_CARD && tab?.id !== undefined) {
    try {
      const res: ContextCardResponse | undefined = await chrome.tabs.sendMessage(
        tab.id,
        { type: GET_CONTEXT_CARD },
        { frameId: info.frameId ?? 0 }
      );
      if (res?.cardName) openLigaMagic(res.cardName, tab);
    } catch {
      // Content script ausente (aba aberta antes da instalação/reload): ignora
    }
  }
});
