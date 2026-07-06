import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

// Reconciled to the internal SSOT (TIER_AND_PRICING_LADDER.md) 2026-06-13:
// Option A fair-use host caps (Team 25 / Business 250 / Scale unlimited), Scale
// led by air-gapped/redistribution + unlimited (never a host number, #1), Custom
// + Commercial-License-Only added (#2a/#2b), SSO is Business+ only and roadmap
// (#3), audit log is SHIPPED and included Team+ (#4).
type Tier = {
  name: string;
  price: string;
  priceUSD?: string;     // simple fixed price for Offer.price
  quoteMin?: string;     // quote-based floor → priceSpecification.minPrice
  billing: 'monthly' | 'yearly' | 'free';
  license: string;
  summary: string;
  description: string;
  cta: {label: string; href: string};
};

const TIERS: readonly Tier[] = [
  {
    name: 'Community',
    price: 'Free',
    priceUSD: '0',
    billing: 'free',
    license: 'AGPL-3.0',
    summary: 'AGPL-3.0, self-hosted, full community feature set',
    description: 'Self-hosted Pharlux under AGPL-3.0. The whole binary, every feature in the metrics+logs surface, no telemetry, no licence check.',
    cta: {label: 'Download', href: 'https://github.com/Veltara-Works/pharlux/releases/latest'},
  },
  {
    name: 'Team',
    price: '$49/mo',
    priceUSD: '49',
    billing: 'monthly',
    license: 'Commercial',
    summary: '25 hosts, 30-day retention, tamper-evident audit log',
    description: 'Commercial license for small teams that cannot accept AGPL terms. 25 hosts (fair-use), 30-day retention, and the tamper-evident audit log.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Team%20license%20enquiry'},
  },
  {
    name: 'Business',
    price: '$199/mo',
    priceUSD: '199',
    billing: 'monthly',
    license: 'Commercial',
    summary: '250 hosts, 90-day retention, audit log; SSO (SAML/OIDC/LDAP, roadmap)',
    description: 'Commercial license for growing teams. 250 hosts (fair-use), 90-day retention, tamper-evident audit log, and SSO (SAML/OIDC/LDAP) on the roadmap.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Business%20license%20enquiry'},
  },
  {
    name: 'Scale',
    price: '$899/mo',
    priceUSD: '899',
    billing: 'monthly',
    license: 'Commercial',
    summary: 'Unlimited hosts & retention, air-gapped / redistribution rights; sized for a single high-capacity VPS',
    description: 'Top self-serve tier. Unlimited hosts and retention, plus air-gapped / binary-redistribution rights. Sized for a single high-capacity VPS (Pharlux is single-node by design).',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Scale%20license%20enquiry'},
  },
  {
    name: 'Custom / Air-gapped',
    price: 'from $12k/mo',
    quoteMin: '12000',
    billing: 'monthly',
    license: 'Commercial',
    summary: 'Unlimited, air-gapped, white-glove SLA (24×7 / 4h SEV-1) + source escrow',
    description: 'Quote-based white-glove tier. Same software as Scale, plus a 24×7 / 4-hour SEV-1 SLA, source escrow, and managed air-gap assistance.',
    cta: {label: 'Talk to us', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20Custom%20%2F%20air-gapped%20enquiry'},
  },
  {
    name: 'Commercial-License-Only',
    price: '$2,400/yr',
    priceUSD: '2400',
    billing: 'yearly',
    license: 'Commercial',
    summary: 'AGPL→commercial relicense, license only (no hosting limits applied)',
    description: 'An orthogonal SKU: the AGPL-to-commercial relicense without hosting. For teams that only need to remove the AGPL obligation, not a hosted feature tier.',
    cta: {label: 'Get license', href: 'mailto:licensing@pharlux.com?subject=Pharlux%20commercial%20license-only%20enquiry'},
  },
];

// Per-tier Product schema — IA-3 / Policy §3 Principle 2. Quote-based tiers use a
// PriceSpecification minPrice; fixed-price tiers use Offer.price.
const PRICING_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': TIERS.map((t) => ({
    '@type': 'Product',
    '@id': `https://pharlux.com/pricing/#${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    name: `Pharlux ${t.name}`,
    description: t.description,
    brand: {'@type': 'Brand', name: 'Pharlux'},
    offers: t.quoteMin
      ? {
          '@type': 'Offer',
          priceCurrency: 'USD',
          url: 'https://pharlux.com/pricing/',
          availability: 'https://schema.org/InStock',
          category: t.license,
          priceSpecification: {'@type': 'PriceSpecification', minPrice: t.quoteMin, priceCurrency: 'USD'},
        }
      : {
          '@type': 'Offer',
          price: t.priceUSD,
          priceCurrency: 'USD',
          url: 'https://pharlux.com/pricing/',
          availability: 'https://schema.org/InStock',
          category: t.license,
        },
  })),
};

// Feature matrix covers the four software tiers. Custom = the same software as
// Scale plus services; Commercial-License-Only is an orthogonal relicense — both
// are explained in the note below the table rather than as extra columns.
type Cell = '✓' | '—' | string;
const FEATURE_ROWS: ReadonlyArray<readonly [string, Cell, Cell, Cell, Cell]> = [
  ['Hosts',                  'Self-host (any)', '25',          '250',          'Unlimited'],
  ['Retention',              'Disk-bound',      '30 days',     '90 days',      'Unlimited'],
  ['OTLP ingest (gRPC + HTTP)', '✓',           '✓',           '✓',            '✓'],
  ['SQL via DataFusion',     '✓',               '✓',           '✓',            '✓'],
  ['Cross-signal JOIN on trace_id', '✓',        '✓',           '✓',            '✓'],
  ['Built-in alerts (SQL rules + Slack/webhook)', '✓', '✓',     '✓',            '✓'],
  ['Embedded UI',            '✓',               '✓',           '✓',            '✓'],
  ['Multi-tenancy',          'Single ("default")', '✓',         '✓',            '✓'],
  ['Tamper-evident audit log', '—',             '✓',           '✓',            '✓'],
  ['SSO (SAML / OIDC / LDAP)', '—',             '—',           'Roadmap',      'Roadmap'],
  ['White-label UI',         '—',               '—',           '—',            'Roadmap'],
  ['S3 cold tier',           '—',               '—',           '—',            'Roadmap'],
  ['Air-gapped / redistribution rights', '✓ (AGPL terms)', '—', '—',           '✓'],
  ['Source available',       '✓',               '✓',           '✓',            '✓'],
  ['Support',                'GitHub Discussions', 'Email',     'Email priority','Email + SLA'],
];

export default function Pricing(): ReactNode {
  return (
    <Layout
      title="Pricing — Pharlux self-hosted observability"
      description="Pharlux pricing: Community is free under AGPL-3.0; commercial tiers (Team $49, Business $199, Scale $899) are generous fair-use ceilings, not a per-host meter. Per-tier feature comparison and FAQ.">
      <Head>
        <title>Pricing — Pharlux self-hosted observability</title>
        <meta property="og:title" content="Pricing — Pharlux self-hosted observability" />
        <meta property="og:description" content="Community free under AGPL-3.0; commercial Team $49 / Business $199 / Scale $899 — generous fair-use host caps, features are the lever. Custom air-gapped from $12k/mo." />
        <meta name="twitter:title" content="Pricing — Pharlux self-hosted observability" />
        <meta name="twitter:description" content="Community free under AGPL-3.0; commercial Team / Business / Scale from $49/mo. Generous fair-use caps; features are the lever." />
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
            commercial tiers add a non-AGPL license, the tamper-evident audit log,
            and (on the larger plans) air-gapped redistribution rights. Host and
            retention figures are <strong>generous fair-use ceilings, not a per-host
            meter</strong> &mdash; tiers ladder on features, support, and redistribution.
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
            Commercial tiers include the Pharlux Enterprise binary. Host and retention
            figures are generous fair-use ceilings, not a per-host meter:{' '}
            <strong>no per-host billing, no per-GB ingest charge, no high-water-mark
            surprises</strong> &mdash; your price doesn&apos;t move when your fleet does.
            Running air-gapped, at fleet scale, or under data-sovereignty rules? See{' '}
            <Link to="/enterprise">Pharlux for air-gapped &amp; at-scale deployments</Link>,
            or{' '}
            <Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Custom%20%2F%20air-gapped%20enquiry">
              talk to us
            </Link>
            .
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>What you get in each tier</Heading>
          <p>Every tier ships from the same source tree. The differences are licensing terms, fair-use scale ceilings, and which Enterprise features are included. The <strong>tamper-evident audit log is shipped today</strong>; items marked <em>Roadmap</em> (SSO, white-label, S3 cold tier) are on the roadmap.</p>
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
          <p className={styles.meta}>
            <strong>Custom / Air-gapped</strong> (from $12k/mo, quote) is the same software as Scale plus white-glove services (24×7 / 4h SEV-1 SLA, source escrow, managed air-gap). <strong>Commercial-License-Only</strong> ($2,400/yr) is an orthogonal SKU — the AGPL→commercial relicense without hosting — not a feature tier.
          </p>
        </section>

        <section className={`${styles.section} ${styles.faq}`}>
          <Heading as="h2" className={styles.sectionTitle}>Pricing questions</Heading>

          <Heading as="h3" className={styles.faqQ}>Why is Community free but the commercial tiers paid? Same binary, right?</Heading>
          <p>Yes, same binary, same metrics+logs feature set. You&apos;re paying for the <em>license terms</em>, not the code. AGPL-3.0 is free but requires that your modifications and any service you build on top of Pharlux be released under AGPL too if you distribute or offer it as a service. The commercial tiers remove that obligation, add the tamper-evident audit log, and give you the support and (on the larger plans) air-gapped redistribution rights.</p>

          <Heading as="h3" className={styles.faqQ}>What counts as a &quot;host&quot;?</Heading>
          <p>One server / VM / VPS that has Pharlux installed. The 25 / 250 / unlimited figures are total Pharlux nodes you operate, not the number of services or applications you observe. A single Pharlux instance can ingest from hundreds of services.</p>

          <Heading as="h3" className={styles.faqQ}>How are the host and retention limits enforced?</Heading>
          <p>They&apos;re carried in your license and enforced locally by the binary &mdash; so it works fully air-gapped and never phones home. Hosts beyond your licensed count aren&apos;t admitted, and retention is clamped to your licensed maximum. The caps are set <em>generously</em> as fair-use ceilings that rarely bite at the single-VPS design centre; if your fleet is growing past yours, you upgrade a tier. There are no per-host overage bills and no surprise charges.</p>

          <Heading as="h3" className={styles.faqQ}>Is there a free trial of the commercial tiers?</Heading>
          <p>We don&apos;t run a 14-day free trial. The Community tier <em>is</em> the trial: it&apos;s the same binary, runs in your own infrastructure, and lets you make a real evaluation against your real workload. When you&apos;re ready for the commercial license terms or the Enterprise features, contact <Link href="mailto:licensing@pharlux.com">licensing@pharlux.com</Link>.</p>

          <Heading as="h3" className={styles.faqQ}>Annual vs monthly?</Heading>
          <p>The list prices are monthly with no commitment. Annual prepay gets you two months free (effectively a 16.7% discount). Email <Link href="mailto:licensing@pharlux.com">licensing@pharlux.com</Link> for the annual quote on your tier.</p>

          <Heading as="h3" className={styles.faqQ}>What about very large fleets, air-gapped, or multi-region?</Heading>
          <p>The Scale tier lifts the licensed host and retention limits entirely (unlimited) and adds air-gapped / binary-redistribution rights &mdash; it is sized for a single high-capacity VPS. Pharlux is single-node by design, so Scale raises the licensed ceilings rather than clustering across machines; multi-VPS clustering and an S3 cold tier are on the roadmap. For air-gapped deployments with a 24×7 SLA and source escrow, the Custom / Air-gapped tier (from $12k/mo) is the quote-based white-glove option &mdash;{' '}
            <Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Custom%20%2F%20air-gapped%20enquiry">
              talk to us
            </Link>.
          </p>

          <Heading as="h3" className={styles.faqQ}>AGPL-3.0 &mdash; does that mean my application becomes AGPL?</Heading>
          <p>No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running Pharlux against your closed-source application does not make your application AGPL. The AGPL trigger is when <em>you</em> modify and distribute Pharlux. If that&apos;s a concern, the commercial license (or the standalone Commercial-License-Only SKU) removes the AGPL terms entirely.</p>
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
