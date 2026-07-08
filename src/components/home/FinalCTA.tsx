import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/** Closing CTA — always dark navy, bookends the hero. */
export default function FinalCTA(): ReactNode {
  return (
    <section className={styles.final}>
      <div className={styles.wrap}>
        <Heading as="h2">Point it at your telemetry today.</Heading>
        <p>
          Download the binary, send it some OTLP, and watch your first dashboard light up — about
          30 seconds end to end.
        </p>
        <div className={styles.finalCta}>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} href="https://github.com/Veltara-Works/pharlux/releases/latest">
            Download Pharlux <span className={styles.arw}>↓</span>
          </Link>
          <Link className={`${styles.btn} ${styles.btnOnDark}`} to="/contact?intent=licensing">
            Talk to us
          </Link>
        </div>
        <div className={styles.deploy}>
          <b>Runs anywhere:</b>
          <span>bare metal</span>
          <span>Docker</span>
          <span>Kubernetes</span>
          <span>air-gapped</span>
          <span>your laptop</span>
        </div>
      </div>
    </section>
  );
}
