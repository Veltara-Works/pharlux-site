import type {ReactNode} from 'react';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/** "What it replaces" — the LGTM component-by-component teardown table. */
export default function Replaces(): ReactNode {
  return (
    <section className={`${styles.blk} ${styles.blkMist}`} id="replaces">
      <div className={styles.wrap}>
        <div className={styles.secHead}>
          <span className={styles.eyebrow}>What it replaces</span>
          <Heading as="h2">The headline isn&apos;t metaphorical.</Heading>
          <p>Component by component, here&apos;s what you stop running once Pharlux is in.</p>
        </div>
        <div className={styles.cmpWrap}>
          <div className={styles.cmpScroll}>
            <table className={styles.cmp}>
              <thead>
                <tr>
                  <th className={styles.old}>Today, with the Grafana / LGTM stack</th>
                  <th className={styles.us}>With Pharlux</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.old}><b>Loki</b> for log aggregation and query</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> Logs ingested via OTLP, stored in per-signal Parquet — same binary</td>
                </tr>
                <tr>
                  <td className={styles.old}><b>Mimir</b> / standalone Prometheus for metrics</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> Metrics via OTLP, same binary, same WAL + Parquet path</td>
                </tr>
                <tr>
                  <td className={styles.old}><b>Tempo</b> for traces</td>
                  <td className={styles.usCell}>Same binary and storage path <em>(on the roadmap)</em></td>
                </tr>
                <tr>
                  <td className={styles.old}><b>Grafana</b> for dashboards and querying</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> Embedded React + ECharts UI; SQL via Apache DataFusion</td>
                </tr>
                <tr>
                  <td className={styles.old}><b>Alertmanager</b> for alerts and notifications</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> Built-in SQL alerts, webhook + Slack output</td>
                </tr>
                <tr>
                  <td className={styles.old}>Deploy and operate <b>object storage</b> (S3 / MinIO)</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> Local Parquet on disk; optional S3 cold tier <em>(roadmap)</em></td>
                </tr>
                <tr>
                  <td className={styles.old}><b>5+ config files</b>, 5+ upgrade cycles, 5+ failure surfaces</td>
                  <td className={styles.usCell}><span className={styles.chk}>✓</span> One <code>pharlux.toml</code>, one binary, one systemd unit</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.honest}>
          <b>Where the Grafana stack is still the better choice.</b> If you run dashboards-as-code
          with years of PromQL alert rules, need horizontal scale-out across regions, or need
          traces or PromQL <em>today</em> — both are on our roadmap — the mature LGTM stack covers
          what Pharlux doesn&apos;t yet. Pharlux is built for the team that would rather not operate
          five systems to observe three.
        </div>
      </div>
    </section>
  );
}
