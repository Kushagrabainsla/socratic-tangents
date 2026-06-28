import { describe, expect, it } from 'vitest';
import { composePrompt } from './engine';

describe('composePrompt', () => {
  it('frames the question with the passage as context', () => {
    expect(composePrompt('the mitochondria', 'why does it matter?')).toBe(
      'Regarding this part: "the mitochondria"\n\nwhy does it matter?',
    );
  });

  it('trims the passage and question', () => {
    expect(composePrompt('  passage  ', '  question  ')).toBe('Regarding this part: "passage"\n\nquestion');
  });

  it('returns just the question when there is no passage', () => {
    expect(composePrompt('', 'standalone?')).toBe('standalone?');
    expect(composePrompt('   ', 'standalone?')).toBe('standalone?');
  });
});
