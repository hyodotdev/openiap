import { MarkdownContent } from "@/components/MarkdownContent";
import contactContent from "@/content/contact.md?raw";

export default function ContactPage() {
  return <MarkdownContent title="Contact" markdown={contactContent} />;
}
