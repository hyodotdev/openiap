import { ExternalLink } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";

type PoweredByCardProps = {
  imageSrc: string;
  imageAlt: string;
  name: string;
  subtitle: string;
  description: string;
  documentationLabel: string;
  documentationUrl: string;
  githubUrl: string;
};

export function PoweredByCard({
  imageSrc,
  imageAlt,
  name,
  subtitle,
  description,
  documentationLabel,
  documentationUrl,
  githubUrl,
}: PoweredByCardProps) {
  return (
    <div className="group card p-6 hover:border-accent transition-all hover:shadow-lg performance-optimized overflow-hidden">
      <div className="flex items-center gap-4 mb-4">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-16 h-16 rounded-lg flex-shrink-0"
        />
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-foreground group-hover:text-accent transition-colors break-words">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <p className="text-muted-foreground mb-4 break-words">{description}</p>
      <div className="flex items-center gap-4">
        <a
          href={documentationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
        >
          <span className="text-sm font-medium">{documentationLabel}</span>
          <ExternalLink className="w-4 h-4" />
        </a>
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${name} on GitHub`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <SiGithub className="w-4 h-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
