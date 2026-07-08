import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/** "Why Pharlux" — three value cards. */
export default function WhyPharlux(): ReactNode {
  return (
    <section className={styles.blk} id="why">
      <div className={styles.wrap}>
        <div className={`${styles.secHead} ${styles.secHeadCenter}`}>
          <span className={styles.eyebrow}>Why Pharlux</span>
          <Heading as="h2">The whole stack, in one clean process.</Heading>
          <p>
            Metrics, logs, dashboards, and alerting — ingested as OpenTelemetry, stored in
            Parquet, queried in SQL. One binary, running where you do.
          </p>
        </div>
        <div className={styles.three}>
          <div className={styles.card}>
            <div className={styles.cardIc}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <Heading as="h3">One binary, not five</Heading>
            <p>
              Metrics, logs, dashboards, and built-in alerting in one 86&nbsp;MiB binary. One{' '}
              <code>pharlux.toml</code>, one systemd unit — no Docker, no ClickHouse, no Kafka,
              no Postgres.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIc}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 17l6-6-6-6" />
                <path d="M12 19h8" />
              </svg>
            </div>
            <Heading as="h3">OpenTelemetry-native</Heading>
            <p>
              OTLP ingest over gRPC (<code>:4317</code>) and HTTP (<code>:4318</code>). Query
              everything as SQL through embedded Apache DataFusion — including cross-signal{' '}
              <code>JOIN</code>s on <code>trace_id</code>.
            </p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIc}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <Heading as="h3">Your data never leaves</Heading>
            <p>
              Self-hosted on a VPS you control — zero data egress, no phone-home, memory-safe
              TLS with zero OpenSSL. Air-gapped and redistribution rights on the higher tiers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
