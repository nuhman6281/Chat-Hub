import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "next-themes";

interface CodeBlockProps {
  code: string;
  language: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  // Handle unsupported languages gracefully
  const [validLanguage, setValidLanguage] = useState(language || "plaintext");
  
  // Normalize language identifier
  useEffect(() => {
    // Map common language names to ones supported by Prism
    const languageMap: Record<string, string> = {
      "js": "javascript",
      "ts": "typescript",
      "jsx": "jsx",
      "tsx": "tsx",
      "py": "python",
      "rb": "ruby",
      "go": "go",
      "java": "java",
      "c": "c",
      "cpp": "cpp",
      "cs": "csharp",
      "php": "php",
      "rust": "rust",
      "swift": "swift",
      "kotlin": "kotlin",
      "md": "markdown",
      "json": "json",
      "html": "html",
      "css": "css",
      "scss": "scss",
      "sql": "sql",
      "sh": "bash",
      "bash": "bash",
      "shell": "bash",
      "yaml": "yaml",
      "yml": "yaml",
      "xml": "xml",
      "graphql": "graphql",
      "dockerfile": "dockerfile",
    };
    
    const normalizedLang = language ? language.toLowerCase().trim() : "";
    const mappedLanguage = languageMap[normalizedLang] || normalizedLang || "plaintext";
    setValidLanguage(mappedLanguage);
  }, [language]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-border bg-card/30 group">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border text-xs font-mono">
        <span className="text-muted-foreground">{validLanguage}</span>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs"
          onClick={copyCode}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      
      <div className="max-h-[400px] overflow-auto">
        <SyntaxHighlighter 
          language={validLanguage} 
          style={isDark ? vscDarkPlus : vs}
          customStyle={{ 
            margin: 0, 
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            background: 'transparent'
          }}
          wrapLongLines={true}
          showLineNumbers={code.split('\n').length > 5}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
