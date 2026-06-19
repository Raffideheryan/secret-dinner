import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { Language } from "../../i18n";

type SeoHeadProps = {
  title: string;
  description: string;
  lang?: Language;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const DEFAULT_IMAGE = "/logo-mark-640.png";

function ensureMeta(selector: string, create: () => HTMLMetaElement): HTMLMetaElement {
  const existing = document.head.querySelector(selector);
  if (existing instanceof HTMLMetaElement) {
    return existing;
  }
  const element = create();
  document.head.appendChild(element);
  return element;
}

function ensureLink(selector: string, create: () => HTMLLinkElement): HTMLLinkElement {
  const existing = document.head.querySelector(selector);
  if (existing instanceof HTMLLinkElement) {
    return existing;
  }
  const element = create();
  document.head.appendChild(element);
  return element;
}

export default function SeoHead({
  title,
  description,
  lang = "en",
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  structuredData,
}: SeoHeadProps) {
  const location = useLocation();

  useEffect(() => {
    const origin = window.location.origin;
    const url = new URL(location.pathname + location.search, origin).toString();
    const fullTitle = title.includes("Secret Dinner") ? title : `${title} | Secret Dinner`;
    const imageUrl = new URL(image, origin).toString();

    document.title = fullTitle;
    document.documentElement.lang = lang;

    const descriptionMeta = ensureMeta('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    });
    descriptionMeta.content = description;

    const robotsMeta = ensureMeta('meta[name="robots"]', () => {
      const meta = document.createElement("meta");
      meta.name = "robots";
      return meta;
    });
    robotsMeta.content = noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";

    const themeMeta = ensureMeta('meta[name="theme-color"]', () => {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      return meta;
    });
    themeMeta.content = "#111715";

    const ogTitle = ensureMeta('meta[property="og:title"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      return meta;
    });
    ogTitle.content = fullTitle;

    const ogDescription = ensureMeta('meta[property="og:description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      return meta;
    });
    ogDescription.content = description;

    const ogType = ensureMeta('meta[property="og:type"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:type");
      return meta;
    });
    ogType.content = type;

    const ogUrl = ensureMeta('meta[property="og:url"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:url");
      return meta;
    });
    ogUrl.content = url;

    const ogImage = ensureMeta('meta[property="og:image"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    });
    ogImage.content = imageUrl;

    const twitterCard = ensureMeta('meta[name="twitter:card"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:card";
      return meta;
    });
    twitterCard.content = "summary_large_image";

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:title";
      return meta;
    });
    twitterTitle.content = fullTitle;

    const twitterDescription = ensureMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:description";
      return meta;
    });
    twitterDescription.content = description;

    const twitterImage = ensureMeta('meta[name="twitter:image"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:image";
      return meta;
    });
    twitterImage.content = imageUrl;

    const canonicalLink = ensureLink('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    });
    canonicalLink.href = url;

    const existingJsonLd = document.getElementById("seo-structured-data");
    if (existingJsonLd) {
      existingJsonLd.remove();
    }
    if (structuredData) {
      const script = document.createElement("script");
      script.id = "seo-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      const currentJsonLd = document.getElementById("seo-structured-data");
      if (currentJsonLd) {
        currentJsonLd.remove();
      }
    };
  }, [description, image, lang, location.pathname, location.search, noindex, structuredData, title, type]);

  return null;
}
