export type FAQItem = {
  question: string;
  answer: string;
};

const SECTION_REGEX = /(?:^|\n)##\s+([^\n]+)\n([\s\S]*?)(?=\n##\s+|$)/g;

/**
 * Converts a markdown document where each FAQ entry is expressed as
 * `## Question` followed by free-form markdown into structured data
 * that can be rendered by a component.
 */
export function parseFaqMarkdown(markdown: string): FAQItem[] {
  if (!markdown.trim()) {
    return [];
  }

  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const items: FAQItem[] = [];

  let match: RegExpExecArray | null;
  while ((match = SECTION_REGEX.exec(normalized)) !== null) {
    const question = match[1]?.trim();
    const answer = match[2]?.trim();

    if (question && answer) {
      items.push({ question, answer });
    }
  }

  return items;
}
