import { MarkdownContent } from "@/components/MarkdownContent";
import privacyContent from "@/content/privacy-policy.md?raw";

export default function PrivacyPolicyPage() {
  return <MarkdownContent title="Privacy Policy" markdown={privacyContent} />;
}
