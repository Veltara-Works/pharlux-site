import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import styles from './home.module.css';

/** Dogfooding proof strip — sits directly under the hero. */
export default function ProofStrip(): ReactNode {
  return (
    <div className={styles.proof}>
      <div className={`${styles.wrap} ${styles.proofIn}`}>
        <div className={styles.proofLead}>
          We run <b>Pharlux on Pharlux</b> — it&apos;s the production observability behind{' '}
          <Link href="https://vectismail.com">Vectis Mail</Link> and{' '}
          <Link href="https://validonx.com">ValidonX</Link>.
        </div>
        <div className={styles.chips}>
          <div className={styles.chip}><b>459/459</b> tests pass</div>
          <div className={styles.chip}><b>10/10</b> crash-recovery runs</div>
          <div className={styles.chip}><b>0</b> external services</div>
        </div>
      </div>
    </div>
  );
}
