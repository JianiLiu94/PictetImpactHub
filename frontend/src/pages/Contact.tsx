import { useState } from "react";
import type { FormEvent } from "react";

const CONTACT_EMAIL = "helloworld@pictet.com";

export function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const subject = `Contact form: ${name}`;
    const body = `${message}\n\n---\nFrom: ${name} (${email})`;
    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setSent(true);
  };

  return (
    <div className="content--narrow">
      <h1 className="page-title">Contact</h1>
      <p className="page-sub">Send a message to the team. This opens your email client addressed to {CONTACT_EMAIL}.</p>

      <div className="card" style={{ maxWidth: 480 }}>
        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="contact-name">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="form-label" htmlFor="contact-email">
            Your email
          </label>
          <input
            id="contact-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="form-label" htmlFor="contact-message">
            Message
          </label>
          <textarea
            id="contact-message"
            className="form-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            required
          />

          <button type="submit" className="toggle-btn" style={{ marginTop: 12 }}>
            Send
          </button>

          {sent && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Opening your email client...
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
