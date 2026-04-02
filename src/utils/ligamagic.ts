/**
 * Utilitários para geração de links e interação com a LigaMagic.
 */

export interface LigaMagicLinkOptions {
  cardName: string;
  /** Código da edição no padrão Scryfall (ex: "c13", "ltr"). Opcional na v1. */
  scryfallSetCode?: string;
}

/**
 * Tipos de busca suportados pela LigaMagic.
 * tipo=1 → cartas singles
 */
const LIGA_BASE = "https://www.ligamagic.com.br";
const LIGA_CARD_TYPE = "1";

/**
 * Normaliza o nome da carta para uso na URL da LigaMagic.
 * - Preserva acentos e caracteres especiais (LigaMagic os aceita)
 * - Substitui espaços por "+"
 * - Casos edge conhecidos: apóstrofos, vírgulas, barras (cartas divididas)
 *
 * Exemplos:
 *   "Baleful Strix"  → "Baleful+Strix"
 *   "Urza's Tower"   → "Urza%27s+Tower"   (apóstrofo encodado)
 *   "Fire // Ice"    → "Fire+%2F%2F+Ice"   (barras encodadas)
 */
export function normalizeCardName(name: string): string {
  // Cartas divididas: Scryfall usa " // ", LigaMagic usa o lado A apenas na busca geral
  const splitName = name.split(" // ")[0].trim();

  // encodeURIComponent trata todos os especiais, depois revertemos espaços para "+"
  return encodeURIComponent(splitName).replace(/%20/g, "+");
}

/**
 * Gera a URL de busca da LigaMagic para uma carta pelo nome.
 * Na v1, não usa código de edição (busca retorna todas as edições disponíveis).
 */
export function buildLigaMagicUrl(options: LigaMagicLinkOptions): string {
  const encoded = normalizeCardName(options.cardName);
  const url = new URL(`${LIGA_BASE}/`);
  url.searchParams.set("view", "cards/card");
  // searchParams.set usa %20 para espaços; reconstruímos manualmente
  const base = `${LIGA_BASE}/?view=cards%2Fcard&card=${encoded}&tipo=${LIGA_CARD_TYPE}`;
  return base;
}

/**
 * Abre a página da carta na LigaMagic em uma nova aba.
 */
export function openInLigaMagic(options: LigaMagicLinkOptions): void {
  const url = buildLigaMagicUrl(options);
  window.open(url, "_blank", "noopener,noreferrer");
}
