// Structured data (JSON-LD). Only emitted in a launch build, where every value is confirmed.
import { absoluteUrl, addressParts, areas, emailText, faqGroups, hours, services, siteName, value, type Service } from './site';
import { DAY_ORDER } from './hours';

const DAY_SCHEMA: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export function localBusiness() {
  const a = addressParts();
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': absoluteUrl('#business'),
    name: siteName(),
    description: `${value('tradeLine')} and roadside assistance in ${value('location')}.`,
    url: absoluteUrl(),
    image: absoluteUrl('og.jpg'),
    telephone: value('phone'),
    email: emailText(),
    slogan: value('tagline'),
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: a.city,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: a.lat, longitude: a.lon },
    areaServed: areas.cities.map((name) => ({ '@type': 'City', name })),
    openingHoursSpecification: DAY_ORDER.filter((d) => hours.days[d]).map((d) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_SCHEMA[d],
      opens: hours.days[d]![0],
      closes: hours.days[d]![1],
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.short } })),
    },
  };
}

export function breadcrumbs(items: { name: string; href?: string }[]) {
  const all = [{ name: 'Home', href: '' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.href !== undefined ? { item: absoluteUrl(c.href) } : {}),
    })),
  };
}

export function faqPage() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqGroups.flatMap((g) => g.items).map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

export function serviceLd(s: Service) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: absoluteUrl(s.href ?? `services/${s.slug}/`),
    provider: { '@id': absoluteUrl('#business') },
    areaServed: areas.cities.map((name) => ({ '@type': 'City', name })),
  };
}

export function articleLd(meta: { title: string; description: string; updated: string }, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title,
    description: meta.description,
    dateModified: meta.updated,
    mainEntityOfPage: absoluteUrl(path),
    author: { '@type': 'Organization', name: siteName() },
    publisher: { '@type': 'Organization', name: siteName() },
  };
}
