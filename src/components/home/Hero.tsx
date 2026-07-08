import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/**
 * Hero — always dark navy in both colour modes. Left: headline + CTAs. Right:
 * a static, decorative "live" dashboard preview (aria-hidden) that mirrors the
 * product's Clarity look without pretending to be interactive.
 */
export default function Hero(): ReactNode {
  return (
    <section className={styles.hero}>
      <div className={styles.cyanGlow} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.heroIn}`}>
        <div>
          <span className={styles.pill}>
            <span className={styles.pillDot} />
            350,000 pts/s on a single VPS
          </span>
          <Heading as="h1" className={styles.heroTitle}>
            Self-hosted observability in a single binary.
          </Heading>
          <p className={styles.lede}>
            Metrics and logs, OpenTelemetry-native, on one VPS you own.{' '}
            <b>No Docker, no Kafka, no ClickHouse</b> — replace Grafana + Prometheus + Loki
            with one 86&nbsp;MiB binary.
          </p>
          <div className={styles.heroCta}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href="https://github.com/Veltara-Works/pharlux/releases/latest">
              Download Pharlux <span className={styles.arw}>↓</span>
            </Link>
            <Link className={`${styles.btn} ${styles.btnOnDark}`} href="https://github.com/Veltara-Works/pharlux">
              View on GitHub
            </Link>
          </div>
          <div className={styles.heroMeta}>
            AGPL-3.0 · static musl binary · runs on an 8&nbsp;GB VPS · v1.2.0
          </div>
        </div>

        <div className={styles.scope} aria-hidden="true">
          <div className={styles.scopeBar}>
            <span className={`${styles.dot} ${styles.dotR}`} />
            <span className={`${styles.dot} ${styles.dotY}`} />
            <span className={`${styles.dot} ${styles.dotG}`} />
            <span className={styles.scopeTitle}>observe.pharlux.internal</span>
            <span className={styles.scopeLive}>live</span>
          </div>
          <div className={styles.scopeBody}>
            <div className={styles.qbar}>
              <span className={styles.kw}>SELECT</span> count(*) <span className={styles.kw}>FROM</span> metrics{' '}
              <span className={styles.kw}>WHERE</span> ts &gt; <span className={styles.fn}>now()</span> -{' '}
              <span className={styles.str}>&apos;30s&apos;</span>
            </div>
            <div className={styles.scopeRow}>
              <div className={styles.kpi}>
                <div className={styles.kpiLab}>Durable ingest</div>
                <div className={`${styles.kpiBig} ${styles.num}`}>
                  350,000<span className={styles.u}>pts/s</span>
                </div>
                <svg className={styles.spark} viewBox="0 0 300 36" preserveAspectRatio="none">
                  <path
                    d="M0,28 L18,24 L36,26 L54,17 L72,21 L90,13 L108,19 L126,11 L144,15 L162,9 L180,14 L198,7 L216,12 L234,6 L252,10 L270,5 L288,9 L300,7 L300,36 L0,36 Z"
                    fill="currentColor"
                    fillOpacity="0.15"
                  />
                  <path
                    d="M0,28 L18,24 L36,26 L54,17 L72,21 L90,13 L108,19 L126,11 L144,15 L162,9 L180,14 L198,7 L216,12 L234,6 L252,10 L270,5 L288,9 L300,7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="300" cy="7" r="2.6" fill="#7ff0e2" />
                </svg>
                <div className={styles.delta}>▲ 0 errors · ~7 ms avg</div>
              </div>
              <div className={styles.side}>
                <div className={styles.kpi}>
                  <div className={styles.kpiLab}>Log severity</div>
                  <div className={styles.donut}>
                    <svg viewBox="0 0 74 74">
                      <g transform="rotate(-90 37 37)" fill="none" strokeWidth="9">
                        <circle cx="37" cy="37" r="28" stroke="var(--i)" strokeDasharray="106 70" />
                        <circle cx="37" cy="37" r="28" stroke="var(--w)" strokeDasharray="49 127" strokeDashoffset="-106" />
                        <circle cx="37" cy="37" r="28" stroke="var(--c)" strokeDasharray="21 155" strokeDashoffset="-155" />
                      </g>
                    </svg>
                    <div className={styles.donutLeg}>
                      <span><i style={{background: 'var(--i)'}} />info</span>
                      <span><i style={{background: 'var(--w)'}} />warn</span>
                      <span><i style={{background: 'var(--c)'}} />error</span>
                    </div>
                  </div>
                </div>
                <div className={`${styles.kpi} ${styles.alerts}`}>
                  <div className={styles.kpiLab}>Alerts</div>
                  <div className={styles.astat}>
                    <span className={styles.adot} />
                    <span className={styles.aval}>1 firing</span>
                  </div>
                  <div className={styles.asub}>cpu_saturation · webhook sent</div>
                </div>
              </div>
            </div>
            <div className={styles.logs}>
              <div className={styles.logrow}>
                <span className={`${styles.sev} ${styles.sevInfo}`}>INFO</span>
                <span>14:22:07</span>
                <span className={styles.logMsg}>otlp batch accepted · 1000 pts</span>
              </div>
              <div className={styles.logrow}>
                <span className={`${styles.sev} ${styles.sevWarn}`}>WARN</span>
                <span>14:22:06</span>
                <span className={styles.logMsg}>wal segment rotated at 64 MiB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
