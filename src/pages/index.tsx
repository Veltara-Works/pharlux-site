import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <main className={styles.placeholderMain}>
        <div className={styles.placeholderInner}>
          <p className={styles.brand}>Pharlux by Veltara Works</p>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.tagline}
          </Heading>
          <p className={styles.note}>
            This page is the Tier-2 IA migration placeholder. The production
            homepage at <Link href="https://pharlux.com/">pharlux.com</Link>{' '}
            still serves the single-page marketing site; this preview branch
            is being rebuilt page-by-page on Docusaurus 3 (IA-1 done; IA-2
            migrates the homepage content here next).
          </p>
          <div className={styles.ctaRow}>
            <Link
              className={`button button--primary button--lg ${styles.cta}`}
              href="https://github.com/Veltara-Works/pharlux">
              View on GitHub
            </Link>
            <Link
              className={`button button--secondary button--lg ${styles.cta}`}
              to="/docs">
              Docs (placeholder)
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
