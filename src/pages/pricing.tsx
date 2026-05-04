import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const TIERS = [
  {
    name: 'Community',
    price: 'Free',
    priceUSD: '0',
    license: 'AGPL-3.0',
    summary: 'AGPL-3.0, self-hosted, full community feature set',
    description: 'Self-hosted Pharlux under AGPL-3.0. The whole binary, every feature in the metrics+logs surface, no telemetry, no licence check.',
    cta: {label: 'Download', href: 'https://github.com/Veltara-Works/pharlux/releases/tag/v1.0.0'},
  },
  {
    name: 'Team',
    price: '$49/mo',
    priceUSD: '49',
    license: 'Commercial',
    summary: '10 hosts, 30-day retention, basic SAML',
    description: 'Commercial license for small teams that cannot accept AGPL terms. Up to 10 hosts, 30-day retention, basic SAML.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Team%20license%20enquiry'},
  },
  {
    name: 'Business',
    price: '$199/mo',
    priceUSD: '199',
    license: 'Commercial',
    summary: '50 hosts, 90-day retention, full SAML/OIDC/LDAP, audit log',
    description: 'Commercial license for growing teams. Up to 50 hosts, 90-day retention, full SAML/OIDC/LDAP, audit log.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Business%20license%20enquiry'},
  },
  {
    name: 'Scale',
    price: '$899/mo',
    priceUSD: '899',
    license: 'Commercial',
    summary: '250 hosts, 1-year retention, white-label, S3 cold tier',
    description: 'Commercial license for production deployments at scale. Up to 250 hosts, 1-year retention, white-label, S3 cold tier.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Scale%20license%20enquiry'},
  },
] as const;

// Per-tier Product schema — IA-3 deliverable per WOW_FACTORS_ANALYSIS §6.
const PRICING_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': TIERS.map((t) => ({
    '@type': 'Product',
    '@id': `https://pharlux.com/pricing/#${t.name.toLowerCase()}`,
    name: `Pharlux ${t.name}`,
    description: t.description,
    brand: {'@type': 'Brand', name: 'Pharlux'},
    offers: {
      '@type': 'Offer',
      price: t.priceUSD,
      priceCurrency: 'USD',
      url: 'https://pharlux.com/pricing/',
      availability: 'https://schema.org/InStock',
      category: t.license,
    },
  })),
};

type Cell = '✓' | '—' | string;
const FEATURE_ROWS: ReadonlyArray<readonly [string, Cell, Cell, Cell, Cell]> = [
  ['Hosts',                  'Self-host (any)', '10',          '50',           '250'],
  ['Retention',              'Disk-bound',      '30 days',     '90 days',      '1 year'],
  ['OTLP ingest (gRPC + HTTP)', '✓',           '✓',           '✓',            '✓'],
  ['SQL via DataFusion',     '✓',               '✓',           '✓',            '✓'],
  ['Cross-signal JOIN on trace_id', '✓',        '✓',           '✓',            '✓'],
  ['Built-in alerts (SQL rules + Slack/webhook)', '✓', '✓',     '✓',            '✓'],
  ['Embedded UI',            '✓',               '✓',           '✓',            '✓'],
  ['Multi-tenancy',          'Single ("default")', '✓',         '✓',            '✓'],
  ['SAML SSO',               '—',               'Basic',       'Full',         'Full'],
  ['OIDC',                   '—',               '—',           '✓',            '✓'],
  ['LDAP',                   '—',               '—',           '✓',            '✓'],
  ['Audit log',              '—',               '—',           '✓',            '✓'],
  ['White-label UI',         '—',               '—',           '—',            '✓'],
  ['S3 cold tier',           '—',               '—',           '—',            '✓'],
  ['Source available',       '✓',               '✓',           '✓',            '✓'],
  ['Right to redistribute',  '✓ (AGPL terms)',  '—',           '—',            '—'],
  ['Support',                'GitHub Discussions', 'Email',     'Email priority','Email + SLA'],
];

export default function Pricing(): ReactNode {
  return (
    <Layout
      title="Pricing — Pharlux"
      description="Pharlux pricing: Community is free under AGPL-3.0; commercial licenses (Team / Business / Scale) start at $49/mo. Per-tier feature comparison and FAQ.">
      <Head>
        <title>Pricing — Pharlux</title>
        <meta property="og:title" content="Pricing — Pharlux" />
        <meta property="og:description" content="Pharlux pricing: Community free under AGPL-3.0; commercial Team / Business / Scale tiers from $49/mo. Per-tier feature comparison." />
        <meta name="twitter:title" content="Pricing — Pharlux" />
        <meta name="twitter:description" content="Pharlux pricing: Community free under AGPL-3.0; commercial Team / Business / Scale tiers from $49/mo." />
        <script type="application/ld+json">{JSON.stringify(PRICING_SCHEMA)}</script>
      </Head>

      <div className={styles.page}>
        <header className={styles.heroHeader}>
          <p className={styles.brand}>Pharlux pricing</p>
          <Heading as="h1" className={styles.heroTitle}>
            Free under AGPL-3.0. Commercial when you need it.
          </Heading>
          <p className={styles.tagline}>
            One product, one binary &mdash; the same Pharlux runs in every tier. The
            commercial tiers add a non-AGPL license, scale-out enterprise features
            (SSO, audit, S3 tier), and longer retention defaults.
          </p>
        </header>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Tiers</Heading>
          <table className={styles.dataTable}>
            <thead>
              <tr><th>Tier</th><th>Price</th><th>Highlights</th><th className={styles.ctaCol}>Action</th></tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td><span className={styles.mono}>{t.price}</span></td>
                  <td>{t.summary}</td>
                  <td className={styles.ctaCol}>
                    <Link href={t.cta.href}>{t.cta.label}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Commercial tiers include the Pharlux Enterprise binary. For deployments
            beyond 250 hosts or custom requirements,{' '}
            <Link href="mailto:licensing@pharlux.com?subject=Pharlux%20commercial%20license%20enquiry">
              talk to us
            </Link>
            .
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>What you get in each tier</Heading>
          <p>Every tier ships from the same source tree. The differences are licensing terms, scale limits, and which Enterprise features unlock.</p>
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Community</th>
                  <th>Team</th>
                  <th>Business</th>
                  <th>Scale</th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map(([label, c, t, b, s]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{c}</td>
                    <td>{t}</td>
                    <td>{b}</td>
                    <td>{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.section} ${styles.faq}`}>
          <Heading as="h2" className={styles.sectionTitle}>Pricing questions</Heading>

          <Heading as="h3" className={styles.faqQ}>Why is Community free but the commercial tiers paid? Same binary, right?</Heading>
          <p>Yes, same binary, same features. You&apos;re paying for the <em>license terms</em>, not the code. AGPL-3.0 is free but requires that your modifications and any service you build on top of Pharlux be released under AGPL too if you distribute or offer it as a service. The commercial tiers remove that obligation, plus give you the support and Enterprise features the larger plans need.</p>

          <Heading as="h3" className={styles.faqQ}>What counts as a &quot;host&quot;?</Heading>
          <p>One server / VM / VPS that has Pharlux installed. The 10/50/250 limits are total Pharlux nodes you operate, not the number of services or applications you observe. A single Pharlux instance can ingest from hundreds of services.</p>

          <Heading as="h3" className={styles.faqQ}>What happens if I exceed my tier&apos;s host limit?</Heading>
          <p>You upgrade. Pharlux does not phone home or stop working &mdash; the limits are contractual. We&apos;ll reach out if your registered fleet looks well over the tier you&apos;re paying for, and we&apos;ll work out the right tier together. There is no &quot;you broke the EULA&quot; surprise at renewal.</p>

          <Heading as="h3" className={styles.faqQ}>Is there a free trial of the commercial tiers?</Heading>
          <p>We don&apos;t run a 14-day free trial. The Community tier <em>is</em> the trial: it&apos;s the same binary, runs in your own infrastructure, and lets you make a real evaluation against your real workload. When you&apos;re ready for the commercial license terms or the Enterprise features, contact <Link href="mailto:licensing@pharlux.com">licensing@pharlux.com</Link>.</p>

          <Heading as="h3" className={styles.faqQ}>Annual vs monthly?</Heading>
          <p>The list prices are monthly with no commitment. Annual prepay gets you two months free (effectively a 16.7% discount). Email <Link href="mailto:licensing@pharlux.com">licensing@pharlux.com</Link> for the annual quote on your tier.</p>

          <Heading as="h3" className={styles.faqQ}>What about scale beyond 250 hosts?</Heading>
          <p>V1&apos;s design centre is 1&ndash;10 services on a single VPS. The Scale tier covers up to 250 hosts, which suits most growth paths without architectural change. Multi-VPS clustering and an S3 cold tier are V1.1+ work. For deployments larger than 250 hosts, we&apos;ll quote a custom contract &mdash;{' '}
            <Link href="mailto:licensing@pharlux.com?subject=Pharlux%20commercial%20license%20enquiry">
              talk to us
            </Link>.
          </p>

          <Heading as="h3" className={styles.faqQ}>AGPL-3.0 &mdash; does that mean my application becomes AGPL?</Heading>
          <p>No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running Pharlux against your closed-source application does not make your application AGPL. The AGPL trigger is when <em>you</em> modify and distribute Pharlux. If that&apos;s a concern, the commercial license removes the AGPL terms entirely.</p>
        </section>

        <section className={styles.section}>
          <div className={styles.contactBox}>
            <p><strong>Commercial licensing enquiries</strong></p>
            <p><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20commercial%20license%20enquiry">licensing@pharlux.com</Link></p>
            <p className={styles.meta}>Replies within 2 business days.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
