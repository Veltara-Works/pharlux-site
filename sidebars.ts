import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'index',
    'getting-started',
    'sizing-guide',
    'host-limits',
    'otlp-configuration',
    'sql-query-reference',
    'logs-query-performance',
    'dashboards',
    'alerts',
    'auth',
    'reverse-proxy',
    'backup-restore',
    'upgrade',
    'troubleshooting',
    {
      type: 'category',
      label: 'Developer reference',
      items: [
        'dev/architecture',
      ],
    },
  ],
};

export default sidebars;
