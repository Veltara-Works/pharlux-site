import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/** "Migrate in an afternoon" — three steps + a decorative install terminal. */
export default function Migrate(): ReactNode {
  return (
    <section className={styles.blk} id="quickstart">
      <div className={styles.wrap}>
        <div className={styles.secHead}>
          <span className={styles.eyebrow}>Migrate in an afternoon</span>
          <Heading as="h2">Move from Prometheus, gradually.</Heading>
          <p>
            Point your OpenTelemetry Collector at Pharlux and run both stacks in parallel — no
            re-instrumentation, no rip-and-replace.
          </p>
        </div>
        <div className={styles.migGrid}>
          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepN}>1</span>
              <span className={styles.stepT}>
                <b>Install the binary.</b> One <code>curl</code>, then <code>pharlux install</code>{' '}
                writes the systemd unit.
              </span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepN}>2</span>
              <span className={styles.stepT}>
                <b>Point your Collector at it.</b> Send OTLP to <code>:4317</code> (gRPC) or{' '}
                <code>:4318</code> (HTTP).
              </span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepN}>3</span>
              <span className={styles.stepT}>
                <b>Query and alert.</b> SQL over metrics and logs via DataFusion, with built-in
                alerts.
              </span>
            </div>
          </div>
          <div className={styles.term}>
            <div className={styles.termBar}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.t}>install.sh</span>
            </div>
            <div className={styles.termBody}>
              <span className={styles.cmt}># download the static musl binary (86 MiB, OpenSSL-free)</span>{'\n'}
              <span className={styles.pr}>$</span> curl -L .../releases/download/v1.2.0/pharlux-…-musl \{'\n'}
              {'    '}-o /usr/local/bin/pharlux &amp;&amp; chmod +x $_{'\n\n'}
              <span className={styles.cmt}># install the systemd unit and start</span>{'\n'}
              <span className={styles.pr}>$</span> sudo pharlux install{'\n'}
              <span className={styles.pr}>$</span> sudo systemctl enable --now pharlux{'\n\n'}
              <span className={styles.cmt}># verify, then point your Collector at :4317 / :4318</span>{'\n'}
              <span className={styles.pr}>$</span> curl :3100/api/v1/health{'\n'}
              <span className={styles.ok}>{'{"status":"ok"}'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
