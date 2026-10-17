export interface NavItem {
  label: string;
  href: string;
  mega?: boolean;
  accent?: boolean;
  children?: { label: string; href: string; hint?: string }[];
}

export const primaryNav: NavItem[] = [
  { label: 'Services', href: 'services/', mega: true },
  { label: 'Roadside Assistance', href: 'roadside-assistance/', accent: true },
  { label: 'Fleet Services', href: 'fleet-services/' },
  {
    label: 'About',
    href: 'about/',
    children: [
      { label: 'About Sunny Side', href: 'about/', hint: 'Who we are and how we work' },
      { label: 'Gallery', href: 'gallery/', hint: 'Photos from the shop and the road' },
      { label: 'Service area', href: 'service-area/', hint: 'Where we work' },
      { label: 'FAQ', href: 'faq/', hint: 'Quick answers' },
    ],
  },
  { label: 'Resources', href: 'resources/' },
  { label: 'Contact', href: 'contact/' },
];

export const footerCompany = [
  { label: 'About', href: 'about/' },
  { label: 'Fleet services', href: 'fleet-services/' },
  { label: 'Gallery', href: 'gallery/' },
  { label: 'Service area', href: 'service-area/' },
  { label: 'FAQ', href: 'faq/' },
  { label: 'Contact', href: 'contact/' },
];

export const footerHelp = [
  { label: 'Request service', href: 'request-service/' },
  { label: 'Roadside assistance', href: 'roadside-assistance/' },
  { label: 'Resources', href: 'resources/' },
  { label: 'Privacy policy', href: 'privacy/' },
  { label: 'Terms of use', href: 'terms/' },
];
