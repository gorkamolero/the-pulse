"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobeIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type Language = "en" | "es";

interface LanguageSelectorProps {
  className?: string;
}

export function LanguageSelector({ className }: LanguageSelectorProps) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("en");

  // Load the language preference from cookies on component mount
  useEffect(() => {
    const languageCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("language="));

    if (languageCookie) {
      const language = languageCookie.split("=")[1] as Language;
      setSelectedLanguage(language);
    }
  }, []);

  const handleLanguageChange = useCallback(
    (language: Language) => {
      setSelectedLanguage(language);

      // Set a cookie to remember the language preference
      document.cookie = `language=${language}; path=/; max-age=31536000`; // 1 year

      // Refresh the page to apply the language change
      router.refresh();
    },
    [router]
  );

  return (
    <Tooltip>
      <DropdownMenu>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className={className}>
              <GlobeIcon size={16} />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => handleLanguageChange("en")}
            className={selectedLanguage === "en" ? "bg-accent" : ""}
          >
            English
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleLanguageChange("es")}
            className={selectedLanguage === "es" ? "bg-accent" : ""}
          >
            Español
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipContent>Change Language</TooltipContent>
    </Tooltip>
  );
}
