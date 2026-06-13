import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const INTENTS = [
  {value: 'general', label: 'General enquiry'},
  {value: 'sales', label: 'Sales, pricing & quotes'},
  {value: 'support', label: 'Technical support'},
  {value: 'licensing', label: 'Commercial licensing'},
];

// Direct addresses — rendered as plain, crawler-readable mailto links (no
// obfuscation) so both people and AI assistants can surface a real contact.
const ADDRESSES = [
  {label: 'General', addr: 'hello@pharlux.com'},
  {label: 'Sales & pricing', addr: 'sales@pharlux.com'},
  {label: 'Support', addr: 'support@pharlux.com'},
  {label: 'Licensing', addr: 'licensing@pharlux.com'},
  {label: 'Security', addr: 'security@pharlux.com'},
];

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  marginTop: '0.35rem',
  marginBottom: '1rem',
  borderRadius: 8,
  border: '1px solid var(--ifm-color-emphasis-300)',
  background: 'var(--ifm-background-surface-color)',
  color: 'var(--ifm-font-color-base)',
  fontSize: '1rem',
  fontFamily: 'inherit',
};

export default function Contact(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const siteKey = (siteConfig.customFields?.turnstileSiteKey as string) || '';

  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Load + render the Turnstile widget (client-only).
  useEffect(() => {
    if (!siteKey) return;
    let interval: ReturnType<typeof setInterval> | undefined;

    const render = () => {
      if (!window.turnstile || !widgetRef.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      });
    };

    if (window.turnstile) {
      render();
      return;
    }
    const id = 'cf-turnstile-script';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    }
    interval = setInterval(() => {
      if (window.turnstile) {
        render();
        if (widgetId.current && interval) clearInterval(interval);
      }
    }, 200);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [siteKey]);

  function resetChallenge() {
    setToken('');
    if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || ''),
      email: String(fd.get('email') || ''),
      intent: String(fd.get('intent') || 'general'),
      message: String(fd.get('message') || ''),
      website: String(fd.get('website') || ''), // honeypot
      token,
    };

    if (siteKey && !token) {
      setErrorMsg('Please complete the verification challenge below.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus('success');
        form.reset();
        resetChallenge();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {error?: string};
      setStatus('error');
      setErrorMsg(data.error || 'Something went wrong. Please email hello@pharlux.com.');
      resetChallenge();
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please email hello@pharlux.com.');
      resetChallenge();
    }
  }

  return (
    <Layout
      title="Contact"
      description="Get in touch with the Pharlux team — sales and pricing, technical support, commercial licensing, or general enquiries.">
      <main className="container margin-vert--lg" style={{maxWidth: 760}}>
        <h1>Contact Pharlux</h1>
        <p>
          Questions about self-hosting Pharlux, pricing, a commercial licence, or
          anything else? Send a message below, or email us directly — we read every one.
        </p>

        <h2>Email us directly</h2>
        <ul>
          {ADDRESSES.map(({label, addr}) => (
            <li key={addr}>
              {label}: <a href={`mailto:${addr}`}>{addr}</a>
            </li>
          ))}
        </ul>
        <p>
          Prefer a form? Use the one below — it reaches the same inboxes. For security
          disclosures, see our{' '}
          <Link to="pathname:///.well-known/security.txt">security.txt</Link>.
        </p>

        <h2>Send a message</h2>
        {status === 'success' ? (
          <div className="alert alert--success" role="alert">
            <strong>Thanks — your message is on its way.</strong> We'll reply to the
            email address you gave us. You can close this page.
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Honeypot: visually hidden, off-screen; humans never see or fill it. */}
            <div
              aria-hidden="true"
              style={{position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden'}}>
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <label htmlFor="name">
              Name
              <input id="name" name="name" type="text" required maxLength={200} style={inputStyle} />
            </label>

            <label htmlFor="email">
              Email
              <input id="email" name="email" type="email" required maxLength={320} style={inputStyle} />
            </label>

            <label htmlFor="intent">
              What's this about?
              <select id="intent" name="intent" defaultValue="general" style={inputStyle}>
                {INTENTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="message">
              Message
              <textarea
                id="message"
                name="message"
                required
                maxLength={5000}
                rows={6}
                style={{...inputStyle, resize: 'vertical'}}
              />
            </label>

            {siteKey ? (
              <div ref={widgetRef} style={{margin: '0.5rem 0 1rem'}} />
            ) : null}

            {errorMsg ? (
              <div className="alert alert--danger" role="alert" style={{marginBottom: '1rem'}}>
                {errorMsg}
              </div>
            ) : null}

            <button
              type="submit"
              className="button button--primary button--lg"
              disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </main>
    </Layout>
  );
}
