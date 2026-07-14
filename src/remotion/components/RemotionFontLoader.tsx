import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import type { CustomFont } from "../../lib/types";

/** Load uploaded brand fonts inside Remotion (preview + export). */
export function RemotionFontLoader({ fonts }: { fonts?: CustomFont[] }) {
  const list = fonts || [];
  const fontKey = list.map((f) => `${f.family}:${f.url}`).join("|");
  const [handle] = useState(() =>
    list.length ? delayRender("Loading custom fonts") : null,
  );

  useEffect(() => {
    if (!handle || !list.length) return;
    let cancelled = false;
    Promise.all(
      list.map(async (f) => {
        const face = new FontFace(f.family, `url(${f.url})`);
        await face.load();
        document.fonts.add(face);
      }),
    )
      .then(() => {
        if (!cancelled) continueRender(handle);
      })
      .catch(() => {
        if (!cancelled) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, fontKey]);

  return null;
}
