const BLOCKLIST = ['spam', 'scam', 'hack', 'kill', 'terrorist'];

export function containsBlockedContent(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BLOCKLIST) {
    if (lower.includes(word)) {
      return `Content contains blocked term "${word}". Please revise your post.`;
    }
  }
  return null;
}
