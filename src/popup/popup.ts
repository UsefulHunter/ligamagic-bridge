/**
 * Script do popup da extensão.
 *
 * Consulta a aba ativa para saber se há uma carta detectada,
 * e exibe o link correspondente para a LigaMagic.
 */

import { buildLigaMagicUrl } from "../utils/ligamagic";

interface CardInfo {
  cardName: string | null;
}

/**
 * Extrai o nome da carta da aba ativa via content script.
 * Usa executeScript para ler o DOM da página.
 */
async function getCardFromActiveTab(): Promise<CardInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) return { cardName: null };

  const url = tab.url;

  // Scryfall: extrai da URL diretamente como fallback rápido
  if (url.includes("scryfall.com/card/")) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.querySelector<HTMLElement>(
            "h1.card-text-title, .card-text-title"
          );
          if (!el) return null;
          // Exclui o custo de mana ({3}{R}) que fica dentro do mesmo <h1>
          const clone = el.cloneNode(true) as HTMLElement;
          clone.querySelector(".card-text-mana-cost")?.remove();
          return clone.textContent?.trim() ?? null;
        },
      });
      const cardName = results?.[0]?.result ?? null;

      // Fallback para slug da URL
      if (!cardName) {
        const match = url.match(/\/card\/[^/]+\/[^/]+\/(.+)$/);
        if (match) {
          const fromSlug = match[1]
            .split("-")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          return { cardName: fromSlug };
        }
      }

      return { cardName };
    } catch {
      return { cardName: null };
    }
  }

  // Moxfield: lê o painel de detalhes injetado pelo content script
  if (url.includes("moxfield.com")) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selectors = [
            ".decklist-card-phantomsearch",
            "[class*='cardName']",
            "[data-testid='card-name']",
          ];
          for (const sel of selectors) {
            const el = document.querySelector<HTMLElement>(sel);
            if (el?.textContent?.trim()) return el.textContent.trim();
          }
          return null;
        },
      });
      return { cardName: results?.[0]?.result ?? null };
    } catch {
      return { cardName: null };
    }
  }

  return { cardName: null };
}

async function init(): Promise<void> {
  const { cardName } = await getCardFromActiveTab();

  const stateUnsupported = document.getElementById("state-unsupported")!;
  const stateCard = document.getElementById("state-card")!;
  const cardNameDisplay = document.getElementById("card-name-display")!;
  const btnOpen = document.getElementById("btn-open") as HTMLAnchorElement;
  const btnCopy = document.getElementById("btn-copy") as HTMLButtonElement;

  if (!cardName) {
    stateUnsupported.style.display = "block";
    stateCard.style.display = "none";
    return;
  }

  const ligaUrl = buildLigaMagicUrl({ cardName });

  stateUnsupported.style.display = "none";
  stateCard.style.display = "block";
  cardNameDisplay.textContent = cardName;
  btnOpen.href = ligaUrl;

  btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ligaUrl);
      btnCopy.textContent = "✓ Link copiado!";
      btnCopy.classList.add("copied");
      setTimeout(() => {
        btnCopy.textContent = "📋 Copiar link";
        btnCopy.classList.remove("copied");
      }, 2000);
    } catch {
      // Fallback para ambientes sem clipboard API
      const input = document.createElement("input");
      input.value = ligaUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
