import { MarkdownContent } from "@/components/MarkdownContent";
import aboutContent from "@/content/about.md?raw";

export default function AboutPage() {
  return <MarkdownContent title="About" markdown={aboutContent} />;
}
