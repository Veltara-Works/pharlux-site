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
        {to: '/pricing', label: 'Pricing', position: 'left'},
        {to: '/docs', label: 'Docs', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {to: '/whatsnew', label: "What's New", position: 'left'},
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
            {label: 'Docs', to: '/docs'},
            {label: 'Blog', to: '/blog'},
            {label: "What's New", to: '/whatsnew'},
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
