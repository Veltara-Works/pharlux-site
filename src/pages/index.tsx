import type {ReactNode} from 'react';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';

import Hero from '@site/src/components/home/Hero';
import ProofStrip from '@site/src/components/home/ProofStrip';
import WhyPharlux from '@site/src/components/home/WhyPharlux';
import Replaces from '@site/src/components/home/Replaces';
import Migrate from '@site/src/components/home/Migrate';
import Pricing from '@site/src/components/home/Pricing';
import Faq from '@site/src/components/home/Faq';
import FinalCTA from '@site/src/components/home/FinalCTA';

const SCHEMA_GRAPH = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://pharlux.com/#veltara-works',
      name: 'Veltara Works',
      url: 'https://veltaraworks.com/',
      sameAs: ['https://github.com/Veltara-Works'],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://pharlux.com/#pharlux',
      name: 'Pharlux',
      alternateName: 'Pharlux by Veltara Works',
      url: 'https://pharlux.com/',
      applicationCategory: 'DeveloperApplication',
      applicationSubCategory: 'Observability',
      operatingSystem: 'Linux',
      softwareVersion: '1.2.0',
      datePublished: '2026-04-17',
      description:
        'A single statically-linked Rust binary delivering unified OpenTelemetry-native observability (metrics and logs) for small teams running 1-10 services on a single VPS.',
      downloadUrl: 'https://github.com/Veltara-Works/pharlux/releases/latest',
      offers: [
        {'@type': 'Offer', name: 'Community', price: '0', priceCurrency: 'USD', category: 'AGPL-3.0 self-hosted, full community feature set'},
        {'@type': 'Offer', name: 'Team', price: '49', priceCurrency: 'USD', category: '25 hosts, 30-day retention, tamper-evident audit log — commercial license'},
        {'@type': 'Offer', name: 'Business', price: '199', priceCurrency: 'USD', category: '250 hosts, 90-day retention, tamper-evident audit log; SSO — SAML/OIDC/LDAP (roadmap) — commercial license'},
        {'@type': 'Offer', name: 'Scale', price: '899', priceCurrency: 'USD', category: 'Unlimited hosts and retention, air-gapped / binary-redistribution rights, sized for a single high-capacity VPS — commercial license'},
        {'@type': 'Offer', name: 'Custom / Air-gapped', priceCurrency: 'USD', priceSpecification: {'@type': 'PriceSpecification', minPrice: '12000', priceCurrency: 'USD'}, category: 'Unlimited hosts and retention, air-gapped deployment, white-glove SLA, source escrow — quote-based, from $12,000/mo'},
        {'@type': 'Offer', name: 'Commercial-License-Only', price: '2400', priceCurrency: 'USD', category: 'AGPL-to-commercial relicense without hosting — billed yearly'},
      ],
      publisher: {'@id': 'https://pharlux.com/#veltara-works'},
      license: 'https://www.gnu.org/licenses/agpl-3.0.html',
      sameAs: ['https://github.com/Veltara-Works/pharlux'],
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://pharlux.com/#faq',
      // NOTE: these five entries must mirror the visible FAQ in
      // src/components/home/Faq.tsx — Google requires FAQ structured data to
      // match on-page content. Keep the two in sync when either changes.
      mainEntity: [
        {'@type': 'Question', name: 'Why not just use Grafana?', acceptedAnswer: {'@type': 'Answer', text: 'Grafana is great, and it is the right choice if you have a dedicated SRE who enjoys operating Loki, Mimir, Tempo, and Alertmanager next to it. Pharlux is for the case where you do not — one binary replaces the whole stack. If you have one engineer who also wants to write product code, that is the trade-off Pharlux optimises for.'}},
        {'@type': 'Question', name: 'How is this different from SigNoz?', acceptedAnswer: {'@type': 'Answer', text: 'SigNoz has the right ambition — unified OpenTelemetry observability — but is built on ClickHouse, which you run and operate alongside it (plus ZooKeeper and PostgreSQL for a clustered setup). Pharlux is a single 86 MiB binary on your VPS, with embedded SQLite for metadata and Parquet on disk. Both are good projects targeting different operational sweet spots.'}},
        {'@type': 'Question', name: 'Can I migrate from Prometheus?', acceptedAnswer: {'@type': 'Answer', text: 'Yes, gradually. Point your OpenTelemetry Collector at Pharlux\'s OTLP endpoint and run both stacks in parallel. PromQL support is on the roadmap; today, queries are SQL via Apache DataFusion. Cross-signal JOINs on trace_id are something a pure-Prometheus stack cannot do.'}},
        {'@type': 'Question', name: 'AGPL-3.0 — do I have to open-source my service?', acceptedAnswer: {'@type': 'Answer', text: 'No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running Pharlux against your closed-source application does not make your application AGPL. If that is a concern, the commercial license removes the AGPL terms entirely.'}},
        {'@type': 'Question', name: 'How do I know it is production-ready?', acceptedAnswer: {'@type': 'Answer', text: 'V1.0.0 shipped 2026-04-17 after a four-phase delivery plan with hard pass/fail gates. 459 of 459 tests pass; 10 of 10 consecutive crash-recovery runs with zero flakes; cargo-deny and cargo-audit gates green. Pharlux is dogfooded on our own production stack — Vectis Mail and ValidonX.'}},
      ],
    },
    {
      '@type': 'HowTo',
      '@id': 'https://pharlux.com/#quickstart-howto',
      name: 'Install Pharlux on a Linux VPS',
      description: 'Install the Pharlux observability binary on a Linux server with systemd, start it as a service, and configure your OpenTelemetry Collector to ingest into it.',
      totalTime: 'PT2M',
      step: [
        {'@type': 'HowToStep', position: 1, name: 'Download the Pharlux binary', text: 'Download the statically-linked Pharlux binary (86 MiB, OpenSSL-free) to /usr/local/bin/pharlux and make it executable.', url: 'https://pharlux.com/#quickstart'},
        {'@type': 'HowToStep', position: 2, name: 'Install the systemd unit and start the service', text: 'Run `sudo pharlux install` to install the systemd unit, then `sudo systemctl daemon-reload` and `sudo systemctl enable --now pharlux` to start the service at boot.', url: 'https://pharlux.com/#quickstart'},
        {'@type': 'HowToStep', position: 3, name: 'Verify the install', text: 'Confirm Pharlux is responding by curling its health endpoint at http://localhost:3100/api/v1/health — a successful response means the binary is running and the API is reachable.', url: 'https://pharlux.com/#quickstart'},
        {'@type': 'HowToStep', position: 4, name: 'Configure your OpenTelemetry Collector', text: 'Point your OpenTelemetry Collector at port 4317 (gRPC) or port 4318 (HTTP/protobuf) on the Pharlux host to start sending metrics and logs.', url: 'https://pharlux.com/#quickstart'},
      ],
    },
  ],
};

export default function Home(): ReactNode {
  return (
    <Layout
      title="Pharlux — self-hosted observability in a single binary"
      description="Pharlux is a single Rust binary for self-hosted, OpenTelemetry-native observability — metrics and logs on one VPS, no Docker, no ClickHouse. Free under AGPL-3.0 + commercial.">
      <Head>
        {/* Override Docusaurus auto-injected meta: title leads with the category
            term ("observability") for AI/search citation; og/twitter use the
            social-card-short form. */}
        <title>Pharlux — self-hosted observability in a single binary</title>
        <meta property="og:title" content="Pharlux — self-hosted observability in a single binary" />
        <meta property="og:description" content="Self-hosted, OpenTelemetry-native observability as a single Rust binary. Metrics + logs on one VPS. Free under AGPL-3.0 + commercial." />
        <meta name="twitter:title" content="Pharlux — self-hosted observability in a single binary" />
        <meta name="twitter:description" content="Self-hosted, OpenTelemetry-native observability as a single Rust binary. Metrics + logs on one VPS. Free under AGPL-3.0 + commercial." />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:alt" content="Pharlux — Replace your LGTM stack with a single binary. Unified OpenTelemetry-native observability. One binary. One config. One systemd unit." />
        <meta property="og:site_name" content="Pharlux" />
        <meta property="og:locale" content="en_AU" />
        <meta name="twitter:image:alt" content="Pharlux — Replace your LGTM stack with a single binary." />
        <script type="application/ld+json">{JSON.stringify(SCHEMA_GRAPH)}</script>
      </Head>

      <main>
        <Hero />
        <ProofStrip />
        <WhyPharlux />
        <Replaces />
        <Migrate />
        <Pricing />
        <Faq />
        <FinalCTA />
      </main>
    </Layout>
  );
}
