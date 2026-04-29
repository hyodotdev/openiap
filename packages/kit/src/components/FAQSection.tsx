import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { FAQItem } from "@/utils/faq";

type FAQSectionProps = {
  title: string;
  description?: string;
  items: FAQItem[];
  className?: string;
};

const markdownComponents = {
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p
      className="text-base leading-7 text-muted-foreground mb-4 last:mb-0"
      {...props}
    />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="list-disc pl-5 space-y-2 text-muted-foreground mb-4 last:mb-0"
      {...props}
    />
  ),
  ol: (props: React.ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="list-decimal pl-5 space-y-2 text-muted-foreground mb-4 last:mb-0"
      {...props}
    />
  ),
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="text-foreground font-semibold" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
};

export function FAQSection({
  title,
  description,
  items,
  className,
}: FAQSectionProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section className={cn("space-y-8", className)}>
      <div className="hero-background rounded-[32px] border border-border/40 shadow-2xl overflow-hidden relative px-6 sm:px-10 py-10 isolate">
        <div className="space-y-3 relative z-10 max-w-3xl">
          <h2 className="text-3xl font-bold text-foreground">{title}</h2>
          {description ? (
            <p className="text-lg text-muted-foreground/90 max-w-2xl">
              {description}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 relative z-10 mt-8">
          {items.map((item, index) => (
            <details
              key={`${item.question}-${index}`}
              className="group bg-background/80 dark:bg-background/60 border border-border/50 rounded-2xl transition-all backdrop-blur"
              open={index === 0}
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none">
                <span className="text-lg font-semibold text-foreground">
                  {item.question}
                </span>
                <span className="text-muted-foreground text-sm">
                  <svg
                    className="w-5 h-5 transition-transform duration-200 group-open:rotate-45"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-6 text-muted-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {item.answer}
                </ReactMarkdown>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
