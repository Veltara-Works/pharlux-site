import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './home.module.css';

/**
 * Pricing — three headline tiers (Community / Business / Custom) with the full
 * ladder summarised beneath. Licensing CTAs route through the contact form with
 * intent + tier preselected (owner rule: no bare emails anywhere).
 */
export default function Pricing(): ReactNode {
  return (
    <section className={`${styles.blk} ${styles.blkMist}`} id="pricing">
      <div className={styles.wrap}>
        <div className={`${styles.secHead} ${styles.secHeadCenter}`}>
          <span className={styles.eyebrow}>Pricing</span>
          <Heading as="h2">Predictable at any scale.</Heading>
          <p>
            Free and self-hosted forever. Commercial tiers ladder on features and support —
            never a per-host or per-GB meter.
          </p>
        </div>
        <div className={styles.priceGrid}>
          <div className={styles.tier}>
            <div className={styles.tname}>Community</div>
            <div className={styles.tprice}>Free</div>
            <div className={styles.tdesc}>The full engine, AGPL-3.0. Self-host forever.</div>
            <ul>
              <li><span className={styles.chk}>✓</span> Metrics &amp; logs, single binary</li>
              <li><span className={styles.chk}>✓</span> Unlimited local retention</li>
              <li><span className={styles.chk}>✓</span> Community support</li>
            </ul>
            <Link className={`${styles.btn} ${styles.btnGhost} ${styles.tierBtn}`} href="https://github.com/Veltara-Works/pharlux/releases/latest">
              Download
            </Link>
          </div>
          <div className={styles.tier}>
            <div className={styles.tname}>Team</div>
            <div className={styles.tprice}>$49<span className={styles.per}> / mo</span></div>
            <div className={styles.tdesc}>For a small fleet getting started.</div>
            <ul>
              <li><span className={styles.chk}>✓</span> 25 hosts · 30-day retention</li>
              <li><span className={styles.chk}>✓</span> Tamper-evident audit log</li>
              <li><span className={styles.chk}>✓</span> Commercial license, no AGPL</li>
            </ul>
            <Link className={`${styles.btn} ${styles.btnGhost} ${styles.tierBtn}`} to="/contact?intent=licensing&tier=team">
              Get a license
            </Link>
          </div>
          <div className={`${styles.tier} ${styles.tierPop}`}>
            <span className={styles.tag}>Most popular</span>
            <div className={styles.tname}>Business</div>
            <div className={styles.tprice}>$199<span className={styles.per}> / mo</span></div>
            <div className={styles.tdesc}>For a real fleet, with an audit trail.</div>
            <ul>
              <li><span className={styles.chk}>✓</span> 250 hosts · 90-day retention</li>
              <li><span className={styles.chk}>✓</span> Tamper-evident audit log</li>
              <li><span className={styles.chk}>✓</span> SSO <em>(roadmap)</em></li>
            </ul>
            <Link className={`${styles.btn} ${styles.btnPrimary} ${styles.tierBtn}`} to="/contact?intent=licensing&tier=business">
              Get a license
            </Link>
          </div>
          <div className={styles.tier}>
            <div className={styles.tname}>Scale</div>
            <div className={styles.tprice}>$899<span className={styles.per}> / mo</span></div>
            <div className={styles.tdesc}>Unlimited scale on a single VPS.</div>
            <ul>
              <li><span className={styles.chk}>✓</span> Unlimited hosts &amp; retention</li>
              <li><span className={styles.chk}>✓</span> Redistribution &amp; air-gap rights</li>
              <li><span className={styles.chk}>✓</span> Commercial license, no AGPL</li>
            </ul>
            <Link className={`${styles.btn} ${styles.btnGhost} ${styles.tierBtn}`} to="/contact?intent=licensing&tier=scale">
              Get a license
            </Link>
          </div>
        </div>
        <p className={styles.priceNote}>
          Figures are fair-use ceilings, not a per-host or per-GB meter. Also{' '}
          <Link to="/enterprise">Custom / Air-gapped</Link> from <b>$12k/mo</b> — quote-based,
          unlimited, air-gapped, white-glove SLA — and a{' '}
          <Link to="/contact?intent=licensing">commercial license without self-hosting</Link>{' '}
          from <b>$2,990/yr</b>. <Link to="/pricing">See the full comparison →</Link>
        </p>
      </div>
    </section>
  );
}
