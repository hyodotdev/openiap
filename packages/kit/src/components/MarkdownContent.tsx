import { useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Footer from "@/components/Footer";

type MarkdownContentProps = {
  title: string;
  markdown: string;
  lastUpdated?: string;
};

const markdownComponents: Components = {
  h1: (props) => <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />,
  h2: (props) => (
    <h2 className="text-3xl font-semibold mt-10 mb-4" {...props} />
  ),
  h3: (props) => <h3 className="text-2xl font-semibold mt-8 mb-3" {...props} />,
  h4: (props) => <h4 className="text-xl font-semibold mt-6 mb-2" {...props} />,
  p: (props) => (
    <p className="text-base leading-7 text-muted-foreground mb-4" {...props} />
  ),
  ul: (props) => (
    <ul
      className="list-disc pl-6 space-y-2 text-muted-foreground mb-4"
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      className="list-decimal pl-6 space-y-2 text-muted-foreground mb-4"
      {...props}
    />
  ),
  li: (props) => <li className="leading-6" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-6"
      {...props}
    />
  ),
  table: (props) => (
    <div className="overflow-x-auto my-6">
      <table
        className="w-full text-sm border border-border rounded-lg"
        {...props}
      />
    </div>
  ),
  thead: (props) => <thead className="bg-muted text-left" {...props} />,
  th: (props) => (
    <th className="px-4 py-2 font-semibold border-b border-border" {...props} />
  ),
  td: (props) => (
    <td className="px-4 py-2 border-t border-border align-top" {...props} />
  ),
  code: ({
    inline,
    ...rest
  }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) => {
    if (inline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
          {...rest}
        />
      );
    }

    return (
      <code
        className="block w-full rounded-lg bg-muted p-4 font-mono text-sm leading-6 overflow-x-auto"
        {...rest}
      />
    );
  },
  pre: (props) => (
    <pre className="my-6 rounded-lg bg-muted p-4 overflow-x-auto" {...props} />
  ),
  a: (props) => (
    <a
      className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  img: (props) => (
    <img
      className="rounded-xl border border-border my-6"
      loading="lazy"
      {...props}
    />
  ),
};

export function MarkdownContent({
  title,
  markdown,
  lastUpdated,
}: MarkdownContentProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      <div className="w-full flex-1">
        <div className="container max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          {lastUpdated ? (
            <p className="text-muted-foreground mb-8">{lastUpdated}</p>
          ) : null}
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
