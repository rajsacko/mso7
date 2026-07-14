"use client";

import { useEffect } from "react";
import type { CustomFont } from "@/lib/types";

/** Inject @font-face rules for uploaded brand typefaces. */
export function CustomFontFaces({ fonts }: { fonts: CustomFont[] }) {
  useEffect(() => {
    if (!fonts?.length) return;
    const id = "mso-custom-fonts";
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = fonts
      .map(
        (f) => `
@font-face {
  font-family: "${f.family}";
  src: url("${f.url}");
  font-display: swap;
}
`,
      )
      .join("\n");
  }, [fonts]);

  return null;
}
