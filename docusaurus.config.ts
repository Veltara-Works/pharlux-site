import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Pharlux',
  tagline: 'Self-hosted observability in a single binary.',
  favicon: 'favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://pharlux.com',
  baseUrl: '/',

  organizationName: 'Veltara-Works',
  projectName: 'pharlux-site',

  customFields: {
    // Public Cloudflare Turnstile sitekey for the /contact form. Safe to embed
    // (sitekeys are public by design); the matching secret lives only in the
    // Pages env (TURNSTILE_SECRET_KEY). Overridable at build via env.
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '0x4AAAAAADkD9sRq9f49GNA3',
  },

  onBrokenLinks: 'throw',
  markdown: {
    // .md = plain CommonMark, .mdx = full MDX. Lets us mirror upstream
    // pharlux/docs/*.md files that contain `<` and `!` (e.g. Slack mrkdwn
    // <!date^...|...> syntax in dev/crate-map.md) without rewriting them.
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        blog: {
          routeBasePath: 'blog',
          blogTitle: 'Pharlux Blog',
          blogDescription: 'Tutorials, technical deep-dives, and operator stories from the Pharlux team.',
          postsPerPage: 10,
          showReadingTime: true,
          authorsMapPath: 'authors.yml',
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'Pharlux Blog',
            copyright: `Pharlux © ${new Date().getFullYear()} Veltara Works · AGPL-3.0 + Commercial`,
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'og-image.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    // /about is added back as IA-6 builds the page.
    navbar: {
      title: 'Pharlux',
      items: [
        {to: '/docs', label: 'Docs', position: 'left'},
        {to: '/pricing', label: 'Pricing', position: 'left'},
        {to: '/enterprise', label: 'Enterprise', position: 'left'},
        {
          type: 'dropdown',
          label: 'Compare',
          position: 'left',
          items: [
            {to: '/compare', label: 'All comparisons'},
            {to: '/compare/grafana-loki', label: 'vs Grafana Loki'},
            {to: '/compare/signoz', label: 'vs SigNoz'},
            {to: '/compare/prometheus', label: 'vs Prometheus'},
            {to: '/compare/datadog', label: 'vs Datadog'},
            {to: '/compare/openobserve', label: 'vs OpenObserve'},
            {to: '/compare/victoriametrics', label: 'vs VictoriaMetrics'},
          ],
        },
        {to: '/benchmarks', label: 'Benchmarks', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {to: '/whatsnew', label: "What's New", position: 'left'},
        {to: '/about', label: 'About', position: 'left'},
        {to: '/contact', label: 'Contact', position: 'right'},
        {
          href: 'https://github.com/Veltara-Works/pharlux',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Product',
          items: [
            {label: 'Pricing', to: '/pricing'},
            {label: 'Enterprise', to: '/enterprise'},
            {label: 'Docs', to: '/docs'},
            {label: 'Benchmarks', to: '/benchmarks'},
            {label: 'Blog', to: '/blog'},
            {label: "What's New", to: '/whatsnew'},
          ],
        },
        {
          title: 'Compare',
          items: [
            {label: 'All comparisons', to: '/compare'},
            {label: 'vs Grafana Loki', to: '/compare/grafana-loki'},
            {label: 'vs SigNoz', to: '/compare/signoz'},
            {label: 'vs Prometheus', to: '/compare/prometheus'},
            {label: 'vs Datadog', to: '/compare/datadog'},
            {label: 'vs OpenObserve', to: '/compare/openobserve'},
            {label: 'vs VictoriaMetrics', to: '/compare/victoriametrics'},
          ],
        },
        {
          title: 'Source',
          items: [
            {label: 'GitHub', href: 'https://github.com/Veltara-Works/pharlux'},
            {label: 'Releases', href: 'https://github.com/Veltara-Works/pharlux/releases'},
            {label: 'Issues', href: 'https://github.com/Veltara-Works/pharlux/issues'},
          ],
        },
        {
          title: 'Veltara Works',
          items: [
            {label: 'About Pharlux', to: '/about'},
            {label: 'Contact', to: '/contact'},
            {label: 'Veltara Works', href: 'https://veltaraworks.com/'},
          ],
        },
      ],
      copyright: `Pharlux © ${new Date().getFullYear()} Veltara Works · AGPL-3.0 + Commercial`,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'toml', 'sql', 'rust'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
