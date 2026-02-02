/**
 * Normalizes text for consistent moderation
 * - Unicode NFKC normalization (handles Japanese compatibility characters)
 * - Trim leading/trailing whitespace
 * - Collapse internal whitespace
 * - Remove trailing newlines
 */
export class TextNormalizer {
  /**
   * Normalizes text for consistent moderation
   * @param text - The text to normalize
   * @returns The normalized text
   */
  static normalize(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\n+$/, '');
  }
}
