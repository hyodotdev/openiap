import { MarkdownContent } from "@/components/MarkdownContent";
import termsContent from "@/content/terms-of-service.md?raw";

export default function TermsOfServicePage() {
  return <MarkdownContent title="Terms of Service" markdown={termsContent} />;
}
