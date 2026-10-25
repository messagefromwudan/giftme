import { RULES, SITE, boxPhotoUrl, type Box, type Locale } from "./catalog";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so catalog text can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const pageUrl = (lang: Locale, path: string) => `${SITE.url}${lang === "en" ? "/en" : ""}${path}`;

export function organizationLd(lang: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    legalName: SITE.legalName,
    url: pageUrl(lang, "/"),
    logo: `${SITE.url}/img/logo-giftme.png`,
    slogan: SITE.slogan[lang],
    email: SITE.email,
    telephone: SITE.phoneIntl,
    address: { "@type": "PostalAddress", addressLocality: "Chișinău", addressCountry: "MD" },
    sameAs: SITE.social.map((s) => s.url),
  };
}

export function productLd(box: Box, lang: Locale) {
  const url = pageUrl(lang, `/cutii/${box.slug}/`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    sku: box.id,
    name: box.name,
    description: box.tagline[lang],
    url,
    image: box.photo ? [boxPhotoUrl(box), `${url}opengraph-image/`] : `${url}opengraph-image/`,
    brand: { "@type": "Brand", name: SITE.name },
    category: lang === "ro" ? "Cutii cadou personalizate" : "Personalized gift boxes",
    additionalProperty: box.contents.map((c) => ({
      "@type": "PropertyValue",
      name: lang === "ro" ? "Conține" : "Contains",
      value: c[lang],
    })),
    offers: {
      "@type": "Offer",
      url,
      price: box.price,
      priceCurrency: SITE.currency,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE.legalName },
      ...(box.custom
        ? {
            description:
              lang === "ro"
                ? "Taxa de serviciu. Cadoul ales de client se cotează separat de echipa GiftMe."
                : "Service fee. The customer's chosen gift is quoted separately by the GiftMe team.",
          }
        : {}),
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "MD" },
        shippingRate: { "@type": "MonetaryAmount", value: RULES.delivery.fee, currency: SITE.currency },
      },
    },
  };
}
