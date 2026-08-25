import {
  ArrowUpRight,
  Gauge,
  Heart,
  ServerCog,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import SEO from '../components/SEO';
import { LIBRARIES, LIBRARY_IMAGES } from '../lib/images';
import {
  CURRENT_SPONSORS,
  FUNDING_LINKS,
  PAST_SUPPORTERS,
} from '../lib/sponsors';

const FUNDING_LINES = [
  {
    icon: Smartphone,
    title: 'Real-device testing',
    description:
      'Store accounts, test hardware, refunds, renewals, and edge cases.',
  },
  {
    icon: ServerCog,
    title: 'Shared IAPKit capacity',
    description: 'Servers, monitoring, receipt validation, and load testing.',
  },
  {
    icon: ShieldCheck,
    title: 'Store change response',
    description:
      'Billing upgrades, policy changes, security, and signed transactions.',
  },
  {
    icon: Gauge,
    title: 'SDK parity',
    description:
      'One reviewed contract across native modules and six frameworks.',
  },
] as const;

function Sponsors() {
  return (
    <div className="xp-page xp-sponsors">
      <SEO
        title="Sponsor OpenIAP"
        description="Sponsor OpenIAP — unified in-app purchase infrastructure used in production across iOS, Android, and emerging platforms. Sponsorship funds maintenance, stability, and long-term platform integration."
        path="/sponsors"
        keywords="OpenIAP sponsors, GitHub Sponsors, IAP infrastructure, in-app purchase open source, vendor sponsorship"
      />

      <main className="xp-shell xp-sponsors-sheet">
        <section
          className="xp-sponsors-opening"
          aria-labelledby="sponsors-title"
        >
          <div className="xp-sponsors-intro">
            <div>
              <p className="xp-kicker">Sponsor OpenIAP</p>
              <h1 id="sponsors-title">Keep the purchase layer open</h1>
              <p className="xp-lede">
                Fund the native modules, shared backend capacity, and framework
                SDKs that teams ship in production.
              </p>
              <div className="xp-hero-actions">
                <a
                  href={FUNDING_LINKS.openCollectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Support the project
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <a
                  href={FUNDING_LINKS.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Heart size={15} aria-hidden="true" />
                  Sponsor the maintainer
                </a>
              </div>
            </div>

            <p className="xp-sponsor-love-note">
              <Heart size={20} strokeWidth={1.7} aria-hidden="true" />
              <span>
                Built in public.
                <strong>Kept open together.</strong>
              </span>
            </p>
          </div>

          <div
            className="xp-sponsor-network"
            aria-label="Current OpenIAP sponsors"
          >
            <div className="xp-sponsor-hub">
              <Heart size={19} strokeWidth={1.6} aria-hidden="true" />
              <strong>OpenIAP</strong>
              <span>kept open by</span>
            </div>

            <ul className="xp-sponsor-node-list">
              {CURRENT_SPONSORS.map((sponsor) => {
                const Wordmark = sponsor.Wordmark;

                return (
                  <li key={sponsor.id} className="xp-sponsor-node">
                    <small>{sponsor.tier}</small>
                    <a
                      href={sponsor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${sponsor.name}`}
                    >
                      <Wordmark />
                    </a>
                  </li>
                );
              })}
              <li className="xp-sponsor-node xp-sponsor-open-node">
                <small>Next</small>
                <a
                  href={FUNDING_LINKS.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Heart size={15} strokeWidth={1.7} aria-hidden="true" />
                  Add your name
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="xp-section" aria-labelledby="shared-stack">
          <div className="xp-section-heading">
            <div>
              <p>One shared stack</p>
              <h2 id="shared-stack">Support travels downstream</h2>
            </div>
            <p>Work funded at the native core reaches every framework SDK.</p>
          </div>

          <div
            className="xp-stack-rail"
            aria-label="OpenIAP supported libraries"
          >
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={LIBRARY_IMAGES['openiap-apple']}
                alt=""
                aria-hidden="true"
              />
              <span>Apple</span>
            </a>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={LIBRARY_IMAGES['openiap-google']}
                alt=""
                aria-hidden="true"
              />
              <span>Google</span>
            </a>
            {LIBRARIES.map((library) => (
              <a
                key={library.name}
                href={library.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={library.image} alt="" aria-hidden="true" />
                <span>{library.homeLabel}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="xp-section" aria-labelledby="funding-title">
          <div className="xp-section-heading">
            <div>
              <p>Where support goes</p>
              <h2 id="funding-title">Maintenance you can ship</h2>
            </div>
            <p>
              AI accelerates this work. Funding keeps humans accountable for it.
            </p>
          </div>

          <ol className="xp-funding-ledger">
            {FUNDING_LINES.map((line, index) => {
              const Icon = line.icon;

              return (
                <li key={line.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <Icon size={21} strokeWidth={1.55} aria-hidden="true" />
                  <strong>{line.title}</strong>
                  <p>{line.description}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="xp-kit-note" aria-labelledby="kit-capacity">
          <div>
            <span>Shared infrastructure</span>
            <a
              href="https://kit.openiap.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>kit.openiap.dev</code>
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div>
            <h2 id="kit-capacity">Keep hosted IAPKit sustainable</h2>
            <p>
              The community instance is free, best-effort, and protected by fair
              use. Teams expecting sustained high volume should contact us
              before launch and help fund the capacity they need.
            </p>
            <p>
              Sponsorship does not include unlimited usage, dedicated resources,
              or an SLA. You can also{' '}
              <a
                href="https://github.com/hyodotdev/openiap/tree/main/packages/kit#deployment-convex--flyio"
                target="_blank"
                rel="noopener noreferrer"
              >
                self-host the MIT-licensed server
              </a>
              .
            </p>
          </div>
        </section>

        <section className="xp-section" aria-labelledby="support-channel">
          <div className="xp-section-heading">
            <div>
              <p>Choose a channel</p>
              <h2 id="support-channel">Fund the work</h2>
            </div>
            <p>
              Project funding stays transparent and separate from maintainer
              support.
            </p>
          </div>

          <div className="xp-support-ledger">
            <a
              href={FUNDING_LINKS.openCollectiveUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Project fund</span>
              <strong>OpenCollective</strong>
              <small>Infrastructure and corporate sponsorship</small>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a
              href={FUNDING_LINKS.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Maintainer</span>
              <strong>GitHub Sponsors</strong>
              <small>Direct support for ongoing maintenance</small>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a
              href={FUNDING_LINKS.paypalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>One-time</span>
              <strong>PayPal</strong>
              <small>Simple individual contribution</small>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <a href={FUNDING_LINKS.companyContactUrl}>
              <span>Company</span>
              <strong>Contact us</strong>
              <small>Procurement, invoicing, and capacity planning</small>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="xp-supporters" aria-labelledby="past-supporters">
          <div>
            <p>With thanks to</p>
            <h2 id="past-supporters">Past supporters</h2>
            <p>Supported the project before the OpenIAP sponsor program.</p>
          </div>
          <div>
            {PAST_SUPPORTERS.map((supporter) => (
              <a
                key={supporter.id}
                href={supporter.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={supporter.logo.src} alt={supporter.name} />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Sponsors;
