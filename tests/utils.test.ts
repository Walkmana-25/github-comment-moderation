import { TextNormalizer } from '../src/utils/textNormalizer';

describe('TextNormalizer', () => {
  describe('normalize', () => {
    it('should remove trailing newlines', () => {
      expect(TextNormalizer.normalize('test\n')).toBe('test');
      expect(TextNormalizer.normalize('test\n\n\n')).toBe('test');
    });

    it('should normalize internal whitespace', () => {
      expect(TextNormalizer.normalize('test   multiple    spaces'))
        .toBe('test multiple spaces');
    });

    it('should handle Japanese text with trailing newline', () => {
      expect(TextNormalizer.normalize('ばーかばーか\n'))
        .toBe('ばーかばーか');
    });

    it('should perform Unicode NFKC normalization', () => {
      const input = 'ばーかばーか\n';
      const expected = 'ばーかばーか';
      expect(TextNormalizer.normalize(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(TextNormalizer.normalize('')).toBe('');
    });

    it('should trim leading whitespace', () => {
      expect(TextNormalizer.normalize('   test')).toBe('test');
    });

    it('should handle text with multiple newlines and spaces', () => {
      expect(TextNormalizer.normalize('  test   with   spaces  \n\n\n'))
        .toBe('test with spaces');
    });

    it('should handle text with tabs and newlines', () => {
      expect(TextNormalizer.normalize('test\t\twith\ttabs\n'))
        .toBe('test with tabs');
    });

    it('should preserve single spaces between words', () => {
      expect(TextNormalizer.normalize('test with spaces'))
        .toBe('test with spaces');
    });
  });
});
