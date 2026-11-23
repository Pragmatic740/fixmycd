/**
 * Code of Ethics text and a tiny, safe formatter. The text is plain: "# " starts a
 * heading, "- " a bullet, a blank line separates paragraphs. It is rendered as
 * React text (never as HTML), so nothing in it can run as markup.
 * Kept free of database code so it can be used on the client and unit tested.
 */
export const MAX_ETHICS_LENGTH = 20_000;

export const DEFAULT_ETHICS_BODY = `# Our Code of Ethics

FixMyDistrict works because neighbours trust what they read here. By posting, commenting, endorsing or sharing, you agree to:

# Be truthful
- Post only problems you have seen yourself or have good reason to believe are real.
- Put the pin where the problem actually is, and use your own photos, videos and recordings.
- Never post fake, staged or copied evidence, or exaggerate how serious something is.

# Be respectful
- No foul or abusive language, threats, harassment or hate of any kind.
- Criticise conditions and services, not individual workers or neighbours.
- Disagree politely in comments; keep to the facts of the problem.

# Protect people's privacy
- Don't post faces, licence plates, house numbers or other personal details that aren't needed to show the problem.
- Never share someone else's personal information.

# Act in good faith
- One person, one account. Don't impersonate anyone or create accounts to boost your own posts.
- No advertising, spam or political campaigning.
- Use flags to report genuine problems, not to silence people you disagree with.

# What happens if these rules are broken
- Anyone can flag a post or comment. Moderators review every flag.
- Content that breaks this code may be hidden, and accounts that repeatedly or seriously break it may be disabled.
- If you think a decision was wrong, contact the FixMyDistrict team.`;

export type EthicsBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

export function parseEthics(body: string): EthicsBlock[] {
  const blocks: EthicsBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    if (list) blocks.push({ type: 'list', items: list });
    paragraph = [];
    list = null;
  };

  for (const raw of body.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith('# ')) {
      flush();
      blocks.push({ type: 'heading', text: line.slice(2).trim() });
    } else if (line.startsWith('- ')) {
      if (paragraph.length) flush();
      (list ??= []).push(line.slice(2).trim());
    } else {
      if (list) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}
