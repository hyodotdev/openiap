import { FAQSection } from "@/components/FAQSection";
import faqContent from "@/content/faq.md?raw";
import { parseFaqMarkdown } from "@/utils/faq";

export default function FaqPage() {
  return (
    <FAQSection
      title="Receipt validation FAQ"
      description="How receipt validation works and what IAPKit does and does not verify."
      items={parseFaqMarkdown(faqContent)}
      className="mx-auto max-w-3xl px-4 py-16"
    />
  );
}
