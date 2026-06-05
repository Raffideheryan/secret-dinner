import { Link } from "react-router-dom";
import "./legal.css";

export default function LegalPage() {
    return (
        <section className="legal-page">
            <div className="legal-page__shell">
                <div className="legal-page__header">
                    <div className="legal-page__intro">
                        <p className="legal-page__eyebrow">Legal</p>
                        <h1 className="legal-page__title">Terms & Policies</h1>
                        <p className="legal-page__description">
                            Everything important in one place: privacy, terms, and cookie policy presented inside the Secret Dinner experience.
                        </p>
                    </div>

                    <div className="legal-page__actions">
                        <Link className="legal-page__back" to="/">
                            Back to Home
                        </Link>
                        <a className="legal-page__ghost" href="/terms.pdf" target="_blank" rel="noreferrer">
                            Open Full PDF
                        </a>
                    </div>
                </div>

                <div className="legal-page__summary">
                    <div className="legal-page__pill">Privacy Policy</div>
                    <div className="legal-page__pill">Terms of Service</div>
                    <div className="legal-page__pill">Cookie Policy</div>
                    <div className="legal-page__meta">
                        <span className="legal-page__meta-label">Format</span>
                        <span className="legal-page__meta-value">Embedded PDF Preview</span>
                    </div>
                </div>

                <div className="legal-page__viewer">
                    <div className="legal-page__viewer-top">
                        <div className="legal-page__viewer-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>
                        <div className="legal-page__viewer-title">
                            Secret Dinner Armenia Legal Framework
                        </div>
                        <a className="legal-page__viewer-link" href="/terms.pdf" target="_blank" rel="noreferrer">
                            Open in new tab
                        </a>
                    </div>

                    <div className="legal-page__frame-wrap">
                        <iframe
                            className="legal-page__frame"
                            src="/terms.pdf#view=FitH"
                            title="Secret Dinner Terms PDF"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
