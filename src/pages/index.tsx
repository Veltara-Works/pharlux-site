import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const QUICKSTART_COMMANDS = `# Download the statically-linked binary (86 MiB, OpenSSL-free)
curl -L https://github.com/Veltara-Works/pharlux/releases/download/v1.2.0/pharlux-v1.2.0-x86_64-unknown-linux-musl \\
  -o /usr/local/bin/pharlux
chmod +x /usr/local/bin/pharlux

# Install the systemd unit and start
sudo pharlux install
sudo systemctl daemon-reload
sudo systemctl enable --now pharlux

# Verify
curl http://localhost:3100/api/v1/health`;

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
      mainEntity: [
        {'@type': 'Question', name: 'Why not just use Grafana?', acceptedAnswer: {'@type': 'Answer', text: 'Grafana is great, and it is the right choice if you have a dedicated SRE who enjoys operating Loki, Mimir, Tempo, and Alertmanager next to it. Pharlux is for the case where you do not — one binary replaces the whole stack. If you have one engineer who also wants to write product code, that is the trade-off Pharlux optimises for.'}},
        {'@type': 'Question', name: 'How is this different from SigNoz?', acceptedAnswer: {'@type': 'Answer', text: 'SigNoz has the right ambition — unified OpenTelemetry observability — but is built on ClickHouse, which you run and operate alongside it (plus ZooKeeper and PostgreSQL for a clustered setup), shipped as a multi-container Docker Compose or Kubernetes deployment. Pharlux is a single 86 MiB binary on your VPS, with embedded SQLite for metadata and Parquet on disk. Both are good projects targeting different operational sweet spots.'}},
        {'@type': 'Question', name: 'Can I migrate from Prometheus?', acceptedAnswer: {'@type': 'Answer', text: 'Yes, gradually. Point your OpenTelemetry Collector at Pharlux\'s OTLP endpoint and run both stacks in parallel. PromQL support is on the roadmap; today, queries are SQL via Apache DataFusion. Cross-signal JOINs on trace_id are something a pure-Prometheus stack cannot do.'}},
        {'@type': 'Question', name: 'What about scale beyond a single VPS?', acceptedAnswer: {'@type': 'Answer', text: 'V1\'s design centre is 1 to 10 services on a single VPS. The Scale tier ($899 per month) lifts the licensed limits entirely — unlimited hosts and unlimited retention — and adds air-gapped / binary-redistribution rights; it is sized for a single high-capacity VPS. Pharlux is single-node by design, so Scale raises the licensed ceilings rather than clustering across machines. Multi-VPS clustering and an S3 cold tier are on the roadmap. Pharlux is deliberately scoped for the small-team operator and does not pretend to be a planet-scale observability platform.'}},
        {'@type': 'Question', name: 'AGPL-3.0 — does that mean I have to open-source my service?', acceptedAnswer: {'@type': 'Answer', text: 'No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running Pharlux against your closed-source application does not make your application AGPL. The AGPL trigger is when you modify and distribute Pharlux. If that is a concern, the commercial license removes the AGPL terms entirely.'}},
        {'@type': 'Question', name: 'Do I have to migrate data when I upgrade?', acceptedAnswer: {'@type': 'Answer', text: 'No. The WAL format and per-signal Parquet schemas are frozen. Releases are additive — new capabilities, no breaking changes. Upgrade is `systemctl stop pharlux`, swap the binary, `systemctl start pharlux`. The same procedure applies for every v1.x patch.'}},
        {'@type': 'Question', name: 'Is there a hosted version?', acceptedAnswer: {'@type': 'Answer', text: 'Not in V1. Pharlux is intentionally self-hosted-first — that is core to the value proposition. A hosted offering may follow at some point, but it is not on the near-term roadmap.'}},
        {'@type': 'Question', name: 'How do I know it is production-ready?', acceptedAnswer: {'@type': 'Answer', text: 'V1.0.0 shipped 2026-04-17 after a four-phase delivery plan with hard pass/fail gates. 459 of 459 tests pass; 10 of 10 consecutive crash-recovery runs with zero flakes; cargo-deny and cargo-audit gates green; AGPL-3.0 source available for review. Pharlux is currently dogfooded on Veltara Works\' own production stack, including Vectis Mail and ValidonX.'}},
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

      <div className={styles.page}>
        <header className={styles.heroHeader}>
          <p className={styles.brand}>
            Pharlux by{' '}
            <Link href="https://veltaraworks.com/" target="_blank" rel="noopener">
              Veltara Works
            </Link>
          </p>
          <span className={styles.badge}>v1.2.0 released &middot; 2026-06-30</span>
          <p className={styles.lastUpdated}>Last updated 2026-07-06</p>
          <Heading as="h1" className={styles.heroTitle}>
            Replace Grafana + Prometheus + Loki with a single binary.
          </Heading>
          <p className={styles.tagline}>
            Self-hosted, OpenTelemetry-native observability for small teams. One binary. One
            config file. One systemd unit. No Docker, no Kafka, no Postgres, no ClickHouse.
          </p>
          <div className={styles.ctaRow}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="https://github.com/Veltara-Works/pharlux/releases/latest">
              Download Pharlux
            </Link>
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="https://github.com/Veltara-Works/pharlux">
              View on GitHub
            </Link>
            <Link className={`${styles.btn} ${styles.btnSecondary}`} href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/getting-started.md">
              Get started
            </Link>
          </div>
        </header>

        <section id="quickstart" className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Quickstart</Heading>
          <figure className={styles.terminalCast}>
            <img
              src="/quickstart.svg"
              alt="Animated terminal of the Pharlux install: download the binary with curl, chmod +x, run sudo pharlux install (writes the systemd unit, config, system user, and data directory), systemctl daemon-reload and enable --now, then curl the health endpoint and see it return ok."
              width={992}
              height={570}
              loading="lazy"
            />
            <figcaption>Demo of the commands below &mdash; about 30 seconds end to end.</figcaption>
          </figure>
          <pre className={styles.codeBlock}><code>{QUICKSTART_COMMANDS}</code></pre>
          <p>
            Point your OpenTelemetry Collector at <code>:4317</code> (gRPC) or{' '}
            <code>:4318</code> (HTTP). Full walkthrough in the{' '}
            <Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/getting-started.md">
              getting started guide
            </Link>
            .
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>What it is</Heading>
          <p>
            Pharlux is a single statically-linked Rust binary that ingests OpenTelemetry
            metrics and logs, stores them in per-signal Parquet files with a custom
            write-ahead log, and serves interactive SQL queries through embedded Apache
            DataFusion. The whole system runs comfortably on an 8&nbsp;GB VPS. Traces are
            on the roadmap.
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Who it is for</Heading>
          <ul>
            <li><strong>Teams running Grafana + Prometheus + Loki</strong> who are tired of operating five moving parts to observe three services.</li>
            <li><strong>Small engineering teams</strong> running between one and ten services on a single VPS.</li>
            <li><strong>Operators</strong> who value reproducible deployments and simple failure modes over horizontally scalable complexity.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>What it replaces</Heading>
          <p>The headline is not metaphorical. Component by component, here is what you stop running once Pharlux is in.</p>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Today, with the Grafana&nbsp;/&nbsp;LGTM stack</th>
                <th>With Pharlux</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>Loki</strong> for log aggregation and query</td><td>Logs ingested via OTLP, stored in per-signal Parquet &mdash; same binary</td></tr>
              <tr><td><strong>Mimir</strong> (or Cortex&nbsp;/&nbsp;standalone Prometheus) for metrics</td><td>Metrics ingested via OTLP, same binary, same WAL&nbsp;+&nbsp;Parquet storage path</td></tr>
              <tr><td><strong>Tempo</strong> for traces</td><td>Traces will share the same binary and storage path <em>(on the roadmap)</em></td></tr>
              <tr><td><strong>Grafana</strong> for dashboards and querying</td><td>Embedded React&nbsp;+&nbsp;ECharts UI served from the same binary; SQL via Apache DataFusion</td></tr>
              <tr><td><strong>Alertmanager</strong> for alerts and notifications</td><td>Built-in SQL-based alerts, state-machine evaluator, webhook&nbsp;+&nbsp;Slack output</td></tr>
              <tr><td>Choose, deploy, and operate <strong>object storage</strong> (S3&nbsp;/&nbsp;MinIO) for log retention</td><td>Local Parquet on disk; optional S3 cold tier is on the roadmap</td></tr>
              <tr><td><strong>5+ config files</strong>, 5+ upgrade cycles, 5+ failure surfaces</td><td>One <code>pharlux.toml</code>, one binary, one systemd unit</td></tr>
            </tbody>
          </table>
          <p>
            <strong>Where the Grafana stack is the better choice.</strong> If you already
            run dashboards-as-code with Grafana provisioning and have years of PromQL
            alert rules, the migration cost may not be worth the operational saving. If
            you need horizontal scale-out across multiple data centres, Pharlux V1&apos;s
            design centre is a single VPS &mdash; the Scale tier lifts the host and
            retention limits entirely, but Pharlux still runs on a single node and does
            not cluster across regions. If you need traces or PromQL{' '}
            <em>today</em>, both are on the roadmap; until then the Grafana stack
            covers what Pharlux does not. And if you have a dedicated SRE who enjoys
            operating the stack, Grafana&apos;s decade-deep plugin ecosystem is a real
            asset.
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>What&apos;s in V1</Heading>
          <ul>
            <li><strong>OTLP-native ingest.</strong> gRPC on <code>:4317</code>, HTTP/protobuf on <code>:4318</code> — both on a shared Tokio runtime with the API.</li>
            <li><strong>SQL over metrics and logs.</strong> Apache DataFusion with a custom <code>TableProvider</code> that unions the live WAL with on-disk Parquet. Cross-signal JOINs on <code>trace_id</code>.</li>
            <li><strong>Multi-tenant from day one.</strong> Every query goes through a logical-plan tenant filter on every table scan. Community deployments use the constant <code>&quot;default&quot;</code> tenant — same code path.</li>
            <li><strong>Built-in alerting.</strong> SQL rules in SQLite, state-machine evaluator with circuit-breaker self-disable, webhook + Slack notifications.</li>
            <li><strong>Embedded React + ECharts UI.</strong> Login, SQL editor (CodeMirror 6), dashboards (metrics bar, log severity pie, recent logs) — served from the same binary via <code>rust-embed</code>.</li>
            <li><strong>Prometheus-format self-metrics.</strong> <code>GET /metrics</code> exposes live atomic counters for ingestion rate, query duration, active queries, and WAL size.</li>
            <li><strong>Operator-ready.</strong> CLI subcommands for <code>install</code>, <code>backup</code>, <code>compact</code>, <code>migrate</code>, <code>version</code>. Crash-safe backup/restore. Full operator <Link href="https://github.com/Veltara-Works/pharlux/blob/main/RUNBOOK.md">runbook</Link>.</li>
            <li><strong>Memory-safe TLS.</strong> <code>rustls</code> for all outbound connections. Zero OpenSSL in the dependency tree. Genuinely static musl binary.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Performance</Heading>
          <p>Load-tested on a 4 vCPU / 8&nbsp;GB VPS (v1.2.0, disk fsync&nbsp;~1.3&nbsp;ms):</p>
          <div className={styles.perfGrid}>
            <div className={styles.perfStat}><span className={styles.perfNum}>350k</span><span className={styles.perfLabel}>durable points/sec (batch 1000)</span></div>
            <div className={styles.perfStat}><span className={styles.perfNum}>0</span><span className={styles.perfLabel}>errors at the sustained rate</span></div>
            <div className={styles.perfStat}><span className={styles.perfNum}>~7 ms</span><span className={styles.perfLabel}>avg request latency</span></div>
            <div className={styles.perfStat}><span className={styles.perfNum}>86 MiB</span><span className={styles.perfLabel}>static binary</span></div>
          </div>
          <p>Sustained durable ingest is single-core-bound, so it scales with your host's CPU and disk. 459 / 459 tests pass; 10 / 10 consecutive crash-recovery runs with zero flakes. See the <Link to="/benchmarks">full benchmark methodology</Link>.</p>
        </section>

        <section id="pricing" className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Pricing</Heading>
          <table className={styles.dataTable}>
            <thead>
              <tr><th>Tier</th><th>Price</th><th>Highlights</th><th className={styles.ctaCol}>Action</th></tr>
            </thead>
            <tbody>
              <tr><td>Community</td><td><span className={styles.mono}>Free</span></td><td>AGPL-3.0, self-hosted, full community feature set</td><td className={styles.ctaCol}><Link href="https://github.com/Veltara-Works/pharlux/releases/latest">Download</Link></td></tr>
              <tr><td>Team</td><td><span className={styles.mono}>$49/mo</span></td><td>25 hosts, 30-day retention, tamper-evident audit log</td><td className={styles.ctaCol}><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Team%20license%20enquiry">Get license</Link></td></tr>
              <tr><td>Business</td><td><span className={styles.mono}>$199/mo</span></td><td>250 hosts, 90-day retention, audit log; SSO <em>(roadmap)</em></td><td className={styles.ctaCol}><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Business%20license%20enquiry">Get license</Link></td></tr>
              <tr><td>Scale</td><td><span className={styles.mono}>$899/mo</span></td><td>Unlimited hosts &amp; retention, air-gapped / redistribution rights</td><td className={styles.ctaCol}><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Scale%20license%20enquiry">Get license</Link></td></tr>
              <tr><td>Custom / Air-gapped</td><td><span className={styles.mono}>from $12k/mo</span></td><td>Unlimited, air-gapped, white-glove SLA + source escrow</td><td className={styles.ctaCol}><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Custom%20%2F%20air-gapped%20enquiry">Talk to us</Link></td></tr>
            </tbody>
          </table>
          <p>
            Host and retention figures are <strong>generous fair-use ceilings, not a
            per-host meter</strong> &mdash; tiers ladder on features, support, and
            redistribution rights. The tamper-evident audit log is shipped and included on
            every commercial tier; SSO, white-label, and the S3 cold tier are on the roadmap.
            See the <Link to="/pricing">full feature comparison and pricing</Link>, or{' '}
            <Link href="mailto:licensing@pharlux.com?subject=Pharlux%20Custom%20%2F%20air-gapped%20enquiry">
              talk to us
            </Link>{' '}about air-gapped or custom requirements.
          </p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Own your observability at scale</Heading>
          <p>
            For the team with a real fleet and a budget: a flat price, on a VPS you
            control, with your telemetry never leaving it. Pharlux&apos;s commercial
            tiers ladder on features, rights, and support &mdash; not a per-host or
            per-GB meter &mdash; so the bill doesn&apos;t move when your fleet does.
          </p>
          <div className={styles.perfGrid}>
            <div className={styles.perfStat}><span className={styles.perfNum}>Flat</span><span className={styles.perfLabel}>monthly license &mdash; never a per-host meter</span></div>
            <div className={styles.perfStat}><span className={styles.perfNum}>Zero</span><span className={styles.perfLabel}>data egress &mdash; telemetry stays on your VPS</span></div>
            <div className={styles.perfStat}><span className={styles.perfNum}>One</span><span className={styles.perfLabel}>binary at every tier, Community to air-gapped</span></div>
          </div>
          <div className={styles.ctaRow}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="mailto:licensing@pharlux.com?subject=Pharlux%20Business%20license%20enquiry">Get a Business license</Link>
            <Link className={`${styles.btn} ${styles.btnSecondary}`} to="/enterprise">Air-gapped &amp; at-scale &rarr;</Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.faq}`}>
          <Heading as="h2" className={styles.sectionTitle}>Frequently asked questions</Heading>

          <Heading as="h3" className={styles.faqQ}>Why not just use Grafana?</Heading>
          <p>Grafana is great, and it is the right choice if you have a dedicated SRE who enjoys operating Loki, Mimir, Tempo, and Alertmanager next to it. Pharlux is for the case where you don&apos;t — one binary replaces the whole stack. If you have one engineer who also wants to write product code, that&apos;s the trade-off Pharlux optimises for.</p>

          <Heading as="h3" className={styles.faqQ}>How is this different from SigNoz?</Heading>
          <p>SigNoz has the right ambition — unified OpenTelemetry observability — but is built on ClickHouse, which you run and operate alongside it (plus ZooKeeper and PostgreSQL for a clustered setup), shipped as a multi-container Docker Compose or Kubernetes deployment. Pharlux is a single 86&nbsp;MiB binary on your VPS, with embedded SQLite for metadata and Parquet on disk. Both are good projects targeting different operational sweet spots.</p>

          <Heading as="h3" className={styles.faqQ}>Can I migrate from Prometheus?</Heading>
          <p>Yes, gradually. Point your OpenTelemetry Collector at Pharlux&apos;s OTLP endpoint and run both stacks in parallel. PromQL support is on the roadmap; today, queries are SQL via Apache DataFusion. Cross-signal <code>JOIN</code>s on <code>trace_id</code> are something a pure-Prometheus stack cannot do.</p>

          <Heading as="h3" className={styles.faqQ}>What about scale beyond a single VPS?</Heading>
          <p>V1&apos;s design centre is 1&ndash;10 services on a single VPS. The Scale tier (<span className={styles.mono}>$899/mo</span>) lifts the licensed limits entirely &mdash; unlimited hosts and unlimited retention &mdash; and adds air-gapped / binary-redistribution rights; it is sized for a single high-capacity VPS. Pharlux is single-node by design, so Scale raises the licensed ceilings rather than clustering across machines. Multi-VPS clustering and an S3 cold tier are on the roadmap. Pharlux is deliberately scoped for the small-team operator and does not pretend to be a planet-scale observability platform.</p>

          <Heading as="h3" className={styles.faqQ}>AGPL-3.0 &mdash; does that mean I have to open-source my service?</Heading>
          <p>No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running Pharlux against your closed-source application does not make your application AGPL. The AGPL trigger is when <em>you</em> modify and distribute Pharlux. If that&apos;s a concern, the commercial license removes the AGPL terms entirely.</p>

          <Heading as="h3" className={styles.faqQ}>Do I have to migrate data when I upgrade?</Heading>
          <p>No. The WAL format and per-signal Parquet schemas are frozen. Releases are additive &mdash; new capabilities, no breaking changes. Upgrade is <code>systemctl stop pharlux</code>, swap the binary, <code>systemctl start pharlux</code>. The same procedure applies for every v1.x patch.</p>

          <Heading as="h3" className={styles.faqQ}>Is there a hosted version?</Heading>
          <p>Not in V1. Pharlux is intentionally self-hosted-first &mdash; that&apos;s core to the value proposition. A hosted offering may follow at some point, but it&apos;s not on the near-term roadmap.</p>

          <Heading as="h3" className={styles.faqQ}>How do I know it&apos;s production-ready?</Heading>
          <p>V1.0.0 shipped 2026-04-17 after a four-phase delivery plan with hard pass/fail gates. 459&nbsp;/&nbsp;459 tests pass; 10&nbsp;/&nbsp;10 consecutive crash-recovery runs with zero flakes; <code>cargo-deny</code> and <code>cargo-audit</code> gates green; AGPL-3.0 source available for review. Pharlux is currently dogfooded on Veltara Works&apos; own production stack &mdash; Vectis&nbsp;Mail and ValidonX.</p>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Documentation</Heading>
          <ul>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/getting-started.md">Getting started</Link> — install, configure, ingest, query</li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/otlp-configuration.md">OTLP configuration reference</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/sql-query-reference.md">SQL query reference</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/reverse-proxy.md">Reverse proxy and TLS setup (Caddy / nginx)</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/backup-restore.md">Backup and restore</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/RUNBOOK.md">Operator runbook</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/docs/user/troubleshooting.md">Troubleshooting</Link></li>
            <li><Link href="https://github.com/Veltara-Works/pharlux/blob/main/CHANGELOG.md">Full changelog</Link></li>
          </ul>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Licensing</Heading>
          <p>
            Pharlux is dual-licensed. The Community edition is free and self-hosted under
            the{' '}
            <Link href="https://www.gnu.org/licenses/agpl-3.0.html">GNU Affero General Public License v3.0</Link>.
            Commercial licenses are available for teams that cannot accept AGPL terms or
            need Enterprise features.
          </p>
          <div className={styles.contactBox}>
            <p><strong>Commercial licensing enquiries</strong></p>
            <p><Link href="mailto:licensing@pharlux.com?subject=Pharlux%20commercial%20license%20enquiry">licensing@pharlux.com</Link></p>
            <p className={styles.meta}>Replies within 2 business days.</p>
          </div>
        </section>

        <section className={styles.section}>
          <Heading as="h2" className={styles.sectionTitle}>Support</Heading>
          <ul>
            <li><strong>Bug reports:</strong>{' '}<Link href="https://github.com/Veltara-Works/pharlux/issues">GitHub Issues</Link></li>
            <li><strong>Questions and community help:</strong>{' '}<Link href="https://github.com/Veltara-Works/pharlux/discussions">GitHub Discussions</Link></li>
            <li><strong>Security reports:</strong> see{' '}<Link href="https://github.com/Veltara-Works/pharlux/blob/main/SECURITY.md">SECURITY.md</Link>{' '}for the coordinated disclosure process</li>
            <li><strong>Commercial support:</strong>{' '}<Link href="mailto:licensing@pharlux.com">licensing@pharlux.com</Link></li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
