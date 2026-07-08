import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/**
 * FAQ — visible copy mirrors the FAQPage JSON-LD in index.tsx. Keep the two in
 * sync when either changes (Google flags mismatched FAQ structured data).
 */
export default function Faq(): ReactNode {
  return (
    <section className={styles.blk}>
      <div className={styles.wrap}>
        <div className={`${styles.secHead} ${styles.secHeadCenter}`}>
          <span className={styles.eyebrow}>Questions</span>
          <Heading as="h2">Everything you&apos;d ask before switching.</Heading>
        </div>
        <div className={styles.faq}>
          <details className={styles.q} open>
            <summary>Why not just use Grafana?<span className={styles.pm}>+</span></summary>
            <div className={styles.qa}>
              Grafana is great, and it&apos;s the right choice if you have a dedicated SRE who
              enjoys operating Loki, Mimir, Tempo, and Alertmanager next to it. Pharlux is for the
              case where you don&apos;t — one binary replaces the whole stack. If you have one
              engineer who also wants to write product code, that&apos;s the trade-off Pharlux
              optimises for.
            </div>
          </details>
          <details className={styles.q}>
            <summary>How is this different from SigNoz?<span className={styles.pm}>+</span></summary>
            <div className={styles.qa}>
              SigNoz has the right ambition — unified OpenTelemetry observability — but is built on
              ClickHouse, which you run and operate alongside it (plus ZooKeeper and PostgreSQL for
              a clustered setup). Pharlux is a single 86&nbsp;MiB binary on your VPS, with embedded
              SQLite for metadata and Parquet on disk. Both are good projects targeting different
              operational sweet spots.
            </div>
          </details>
          <details className={styles.q}>
            <summary>Can I migrate from Prometheus?<span className={styles.pm}>+</span></summary>
            <div className={styles.qa}>
              Yes, gradually. Point your OpenTelemetry Collector at Pharlux&apos;s OTLP endpoint and
              run both stacks in parallel. PromQL support is on the roadmap; today, queries are SQL
              via Apache DataFusion. Cross-signal <code>JOIN</code>s on <code>trace_id</code> are
              something a pure-Prometheus stack cannot do.
            </div>
          </details>
          <details className={styles.q}>
            <summary>AGPL-3.0 — do I have to open-source my service?<span className={styles.pm}>+</span></summary>
            <div className={styles.qa}>
              No. AGPL applies to Pharlux itself, not to the services Pharlux observes. Running
              Pharlux against your closed-source application does not make your application AGPL. If
              that&apos;s a concern, the commercial license removes the AGPL terms entirely.
            </div>
          </details>
          <details className={styles.q}>
            <summary>How do I know it&apos;s production-ready?<span className={styles.pm}>+</span></summary>
            <div className={styles.qa}>
              V1.0.0 shipped 2026-04-17 after a four-phase delivery plan with hard pass/fail gates.
              459/459 tests pass; 10/10 consecutive crash-recovery runs with zero flakes;{' '}
              <code>cargo-deny</code> and <code>cargo-audit</code> gates green. Pharlux is dogfooded
              on our own production stack — <Link href="https://vectismail.com">Vectis Mail</Link>{' '}
              and <Link href="https://validonx.com">ValidonX</Link>.
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
