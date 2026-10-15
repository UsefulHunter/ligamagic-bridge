/**
 * Service worker da extensão: itens no menu de contexto (clique direito).
 *
 *   - "Ver na LigaMagic": nos sites suportados, abre a carta sob o cursor.
 *     O título é fixo porque o Chrome monta o menu antes de o content script
 *     conseguir atualizá-lo; a carta é resolvida só no clique, lendo o nome
 *     que o content script gravou no <html> no último "contextmenu".
 *     Moxfield e Archidekt ficam de fora: eles substituem o menu nativo nas
 *     cartas por um menu próprio.
 *
 *   - "Buscar '%s' na LigaMagic": em qualquer site, busca o texto selecionado.
 */

import { buildLigaMagicUrl } from "./utils/ligamagic";
import { CONTEXT_CARD_ATTR } from "./utils/contextMenu";

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
      // O clique no menu concede activeTab, suficiente para o executeScript
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
        func: (attr: string) =>
          document.documentElement.getAttribute(attr),
        args: [CONTEXT_CARD_ATTR],
      });
      const cardName = result?.result;
      if (cardName) openLigaMagic(cardName, tab);
    } catch (err) {
      console.warn("[MTG Bridge] Falha ao resolver a carta do menu:", err);
    }
  }
});
