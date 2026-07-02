import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import VideoSlot, { type VideoVariant } from './VideoSlot';

type VideoKey =
  | 'overview'
  | 'purchase'
  | 'subscription'
  | 'available'
  | 'verification';

interface ProofPoint {
  area: string;
  proof: ReactNode;
  where: ReactNode;
}

interface ReadinessItem {
  item: string;
  expected: ReactNode;
}

interface VerificationItem {
  part: string;
  explanation: ReactNode;
}

interface StoreVideoCopy {
  title: string;
  description: string;
  src?: string;
  poster?: string;
  variants?: VideoVariant[];
}

export interface StoreExampleConfig {
  title: string;
  seo: {
    title: string;
    description: string;
    path: string;
    keywords: string;
  };
  storeName: string;
  sourcePath: string;
  sourceHref: string;
  intro: ReactNode;
  goal: ReactNode;
  overview: ReactNode;
  overviewImage?: {
    src: string;
    alt: string;
  };
  proofPoints: ProofPoint[];
  productSkus: string[];
  subscriptionSkus: string[];
  purchaseRequestShape: ReactNode;
  subscriptionRequestShape: ReactNode;
  purchaseUpdateText: ReactNode;
  finishText: ReactNode;
  subscriptionManagementText: ReactNode;
  availablePurchasesText: ReactNode;
  verificationIntro: ReactNode;
  verificationItems: VerificationItem[];
  readinessTitle: string;
  readinessIntro: ReactNode;
  readinessItems: ReadinessItem[];
  frameworkIntro: ReactNode;
  frameworkNote: ReactNode;
  frameworkVerificationApi: {
    label: string;
    to: string;
  };
  frameworkSnippet: string;
  buildCommand: string;
  videos: Record<VideoKey, StoreVideoCopy>;
}

function CodeLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to}>
      <code>{children}</code>
    </Link>
  );
}

function CodeList({ values }: { values: string[] }) {
  return (
    <>
      {values.map((value, index) => (
        <Fragment key={value}>
          {index > 0 ? ', ' : null}
          <code>{value}</code>
        </Fragment>
      ))}
    </>
  );
}

function ExampleVideo({
  video,
  fallbackTitle,
}: {
  video: StoreVideoCopy;
  fallbackTitle: string;
}) {
  return (
    <VideoSlot
      title={video.title || fallbackTitle}
      description={video.description}
      src={video.src}
      poster={video.poster}
      variants={video.variants}
    />
  );
}

function StoreExampleTemplate({ config }: { config: StoreExampleConfig }) {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title={config.seo.title}
        description={config.seo.description}
        path={config.seo.path}
        keywords={config.seo.keywords}
      />
      <h1>{config.title}</h1>
      <p>{config.intro}</p>
      <blockquote className="info-note">
        <strong>Goal for this walkthrough:</strong> {config.goal}
      </blockquote>

      <section>
        <AnchorLink id="overview" level="h2">
          Demo Overview
        </AnchorLink>
        <p>{config.overview}</p>
        {config.overviewImage ? (
          <img
            className="example-overview-image"
            src={config.overviewImage.src}
            alt={config.overviewImage.alt}
          />
        ) : null}
        <ul>
          <li>
            Confirm the walkthrough is using the intended store target before
            touching a purchase button.
          </li>
          <li>
            Record each action separately: purchase flow, subscription flow,
            available purchases, and verification.
          </li>
          <li>
            Keep the narration focused on the shared OpenIAP lifecycle:
            initialize, fetch, request, verify, finish, and refresh.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="proof-points" level="h2">
          Proof Points
        </AnchorLink>
        <p>
          These are the details the video should make obvious before the article
          moves into framework code. They keep the page store-first instead of
          reading like a generic UI tour.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>What this target proves</th>
              <th>Where it appears</th>
            </tr>
          </thead>
          <tbody>
            {config.proofPoints.map((point) => (
              <tr key={point.area}>
                <td>{point.area}</td>
                <td>{point.proof}</td>
                <td>{point.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="purchase-flow" level="h2">
          Purchase Flow
        </AnchorLink>
        <div className="example-action-layout">
          <ExampleVideo
            video={config.videos.purchase}
            fallbackTitle="Purchase Flow"
          />
          <div className="example-action-copy">
            <p>
              This menu covers consumables and non-consumables. The screen calls{' '}
              <CodeLink to="/docs/apis/init-connection">
                initConnection
              </CodeLink>
              , then fetches the example in-app SKU list with{' '}
              <CodeLink to="/docs/apis/fetch-products">fetchProducts</CodeLink>.
              In the video, show the verification selector first, then the
              product rows, and then the <strong>Buy</strong> action.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Load products</td>
                  <td>
                    <CodeLink to="/docs/apis/fetch-products">
                      fetchProducts
                    </CodeLink>{' '}
                    with the in-app product type.
                  </td>
                  <td>
                    Store catalog data is normalized into OpenIAP products such
                    as <CodeList values={config.productSkus} />.
                  </td>
                </tr>
                <tr>
                  <td>Start purchase</td>
                  <td>
                    <CodeLink to="/docs/apis/request-purchase">
                      requestPurchase
                    </CodeLink>{' '}
                    with {config.purchaseRequestShape}.
                  </td>
                  <td>
                    The button launches the store purchase sheet for one
                    selected product and then waits for a purchase update.
                  </td>
                </tr>
                <tr>
                  <td>Handle update</td>
                  <td>{config.purchaseUpdateText}</td>
                  <td>
                    This is where the app waits for the store result instead of
                    treating the button tap itself as proof of purchase.
                  </td>
                </tr>
                <tr>
                  <td>Verify and finish</td>
                  <td>{config.finishText}</td>
                  <td>
                    Consumables are consumed; non-consumables are fulfilled.
                    Access should be unlocked only after the verification result
                    is accepted.
                  </td>
                </tr>
              </tbody>
            </table>
            <blockquote className="info-note">
              The store-specific work belongs in the adapter. The app code
              continues to fetch, request, verify, finish, and refresh using the
              OpenIAP lifecycle.
            </blockquote>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="subscription-flow" level="h2">
          Subscription Flow
        </AnchorLink>
        <div className="example-action-layout">
          <ExampleVideo
            video={config.videos.subscription}
            fallbackTitle="Subscription Flow"
          />
          <div className="example-action-copy">
            <p>
              This menu demonstrates recurring products. The example checks
              current subscription state, fetches product metadata, and then
              launches the subscription purchase request.
            </p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Check state</td>
                  <td>
                    <CodeLink to="/docs/apis/get-active-subscriptions">
                      getActiveSubscriptions
                    </CodeLink>{' '}
                    with the subscription SKU list.
                  </td>
                  <td>
                    Separate "what is currently active" from "what can be
                    purchased" before showing the offer rows.
                  </td>
                </tr>
                <tr>
                  <td>Load offers</td>
                  <td>
                    <CodeLink to="/docs/apis/fetch-products">
                      fetchProducts
                    </CodeLink>{' '}
                    with the subscription product type.
                  </td>
                  <td>
                    Subscription products such as{' '}
                    <CodeList values={config.subscriptionSkus} /> are displayed
                    as normalized OpenIAP subscription products.
                  </td>
                </tr>
                <tr>
                  <td>Start subscription</td>
                  <td>
                    <CodeLink to="/docs/apis/request-purchase">
                      requestPurchase
                    </CodeLink>{' '}
                    with {config.subscriptionRequestShape}.
                  </td>
                  <td>{config.subscriptionManagementText}</td>
                </tr>
                <tr>
                  <td>Finalize</td>
                  <td>{config.finishText}</td>
                  <td>
                    Subscriptions are not consumed like consumables. Finishing
                    records store fulfillment while the app keeps entitlement
                    state driven by verified subscription status.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="available-purchases" level="h2">
          Available Purchases
        </AnchorLink>
        <div className="example-action-layout">
          <ExampleVideo
            video={config.videos.available}
            fallbackTitle="Available Purchases"
          />
          <div className="example-action-copy">
            <p>{config.availablePurchasesText}</p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th>Code path</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Refresh</td>
                  <td>
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>
                    .
                  </td>
                  <td>
                    The app can rebuild entitlement state after launch or after
                    a network/store reconnect.
                  </td>
                </tr>
                <tr>
                  <td>Restore</td>
                  <td>
                    <CodeLink to="/docs/apis/restore-purchases">
                      restorePurchases
                    </CodeLink>{' '}
                    or{' '}
                    <CodeLink to="/docs/apis/get-available-purchases">
                      getAvailablePurchases
                    </CodeLink>
                    .
                  </td>
                  <td>
                    This is the recovery path for reinstalls, device changes,
                    and account changes.
                  </td>
                </tr>
                <tr>
                  <td>Group purchases</td>
                  <td>
                    The screen groups active subscriptions, owned
                    non-consumables, and pending consumables.
                  </td>
                  <td>
                    The split gives the article clear talking points: active
                    access, permanent ownership, and transactions that still
                    need fulfillment.
                  </td>
                </tr>
                <tr>
                  <td>Finish unfinished</td>
                  <td>
                    Unfinished rows call{' '}
                    <CodeLink to="/docs/apis/finish-transaction">
                      finishTransaction
                    </CodeLink>{' '}
                    after validation.
                  </td>
                  <td>
                    Restore and verification are not enough by themselves: the
                    store transaction must still be fulfilled or consumed.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="verification" level="h2">
          Purchase Verification
        </AnchorLink>
        <div className="example-action-layout">
          <ExampleVideo
            video={config.videos.verification}
            fallbackTitle="Purchase Verification"
          />
          <div className="example-action-copy">
            <p>{config.verificationIntro}</p>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>What to explain</th>
                </tr>
              </thead>
              <tbody>
                {config.verificationItems.map((item) => (
                  <tr key={item.part}>
                    <td>{item.part}</td>
                    <td>{item.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="warning-box">
              <strong>Production rule</strong>
              <p>
                Verification is the gate; finishing is the receipt lifecycle
                cleanup. Do not call <code>finishTransaction</code> as the only
                proof that content should be unlocked.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <AnchorLink id="readiness" level="h2">
          {config.readinessTitle}
        </AnchorLink>
        <p>{config.readinessIntro}</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Checklist</th>
              <th>Expected state</th>
            </tr>
          </thead>
          <tbody>
            {config.readinessItems.map((item) => (
              <tr key={item.item}>
                <td>{item.item}</td>
                <td>{item.expected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="framework-handoff" level="h2">
          Framework Handoff
        </AnchorLink>
        <p>{config.frameworkIntro}</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Flow</th>
              <th>Shared API</th>
              <th>Framework note</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Product and subscription loading</td>
              <td>
                <CodeLink to="/docs/apis/fetch-products">
                  fetchProducts
                </CodeLink>
              </td>
              <td>
                Available in Expo, React Native, Flutter, Kotlin Multiplatform,
                .NET MAUI, and Godot with the same OpenIAP operation name.
              </td>
            </tr>
            <tr>
              <td>Starting a purchase</td>
              <td>
                <CodeLink to="/docs/apis/request-purchase">
                  requestPurchase
                </CodeLink>
              </td>
              <td>
                The request shape changes by language, but the lifecycle stays
                the same: pass a SKU, wait for the purchase update, then verify.
              </td>
            </tr>
            <tr>
              <td>Restore and entitlement recovery</td>
              <td>
                <CodeLink to="/docs/apis/get-available-purchases">
                  getAvailablePurchases
                </CodeLink>
              </td>
              <td>
                Use this after launch, after restore, and after finishing a
                transaction to rebuild local entitlement state.
              </td>
            </tr>
            <tr>
              <td>Managed verification</td>
              <td>
                <CodeLink to={config.frameworkVerificationApi.to}>
                  {config.frameworkVerificationApi.label}
                </CodeLink>
              </td>
              <td>{config.frameworkNote}</td>
            </tr>
            <tr>
              <td>Final fulfillment</td>
              <td>
                <CodeLink to="/docs/apis/finish-transaction">
                  finishTransaction
                </CodeLink>
              </td>
              <td>
                Finish after verification. Consumables are consumed; owned
                products and subscriptions are fulfilled without consuming.
              </td>
            </tr>
          </tbody>
        </table>
        <CodeBlock language="typescript">{config.frameworkSnippet}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="video-script" level="h2">
          Video Script
        </AnchorLink>
        <p>
          Keep each clip short, but make the action and the evidence visible.
          This structure gives the article/video a clean sequence instead of a
          raw list of recordings.
        </p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Clip</th>
              <th>Open with</th>
              <th>Close on</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Overview</td>
              <td>
                Show the store target and explain that this is the{' '}
                {config.storeName} pass of the shared OpenIAP example flow.
              </td>
              <td>
                Land on the three menus: purchase flow, subscription flow, and
                available purchases.
              </td>
            </tr>
            <tr>
              <td>Purchase Flow</td>
              <td>Show the verification selector, then the product rows.</td>
              <td>
                Show the purchase result or the exact tester/catalog requirement
                if the store sheet cannot proceed.
              </td>
            </tr>
            <tr>
              <td>Subscription Flow</td>
              <td>
                Show monthly and annual subscription rows loaded through
                OpenIAP.
              </td>
              <td>Show the store-specific subscription management language.</td>
            </tr>
            <tr>
              <td>Available Purchases</td>
              <td>Tap refresh or restore.</td>
              <td>
                Show restored count, grouped purchase rows, or the empty state
                with the correct store account wording.
              </td>
            </tr>
            <tr>
              <td>Purchase Verification</td>
              <td>Show the configured verification option.</td>
              <td>
                Explain what receipt/token leaves the client and why the app
                finishes only after a verified result.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="build-run" level="h2">
          Build and Run
        </AnchorLink>
        <p>
          Source: <code>{config.sourcePath}</code>
        </p>
        <CodeBlock language="bash">{config.buildCommand}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="source" level="h2">
          Source
        </AnchorLink>
        <p>
          <a
            href={config.sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="external-link"
          >
            View {config.title} on GitHub
          </a>
        </p>
      </section>
    </div>
  );
}

export default StoreExampleTemplate;
