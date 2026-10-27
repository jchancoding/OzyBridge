import { useState } from 'react';
import { Footer } from './Footer';
import { FORMSUBMIT_ID, submitForm } from './submit';

export function Feedback() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const canSubmit = FORMSUBMIT_ID && message.trim().length > 0;

  const send = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setFailed(false);
    const ok = await submitForm('feedback', {
      message: message.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
    });
    setBusy(false);
    if (ok) setSent(true);
    else setFailed(true);
  };

  if (!FORMSUBMIT_ID) {
    return (
      <main className="app screen">
        <p className="message">Feedback is not available in this build.</p>
        <p><a href="/">Back to OzyBridge</a></p>
        <Footer />
      </main>
    );
  }

  return (
    <main className="app screen">
      <h1 className="display">Feedback</h1>
      <section className="intro">
        <p>
          Testing a device? Use the{' '}
          <a href="?verify">device test</a> instead: it fills in the details for you.
        </p>
      </section>
      {sent ? (
        <p className="message">Thanks for your feedback.</p>
      ) : (
        <>
          <label className="verify-field">
            <span className="label">Message</span>
            <textarea className="verify-textarea" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <label className="verify-field">
            <span className="label">Reply email (optional)</span>
            <input className="verify-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <div className="bench-row">
            <button className="btn-primary" type="button" disabled={busy || !canSubmit} onClick={send}>
              Send
            </button>
            <a className="btn-secondary verify-back" href="/">Cancel</a>
          </div>
          {failed && <p className="message error">Could not send. Try again later.</p>}
        </>
      )}
      <Footer />
    </main>
  );
}
