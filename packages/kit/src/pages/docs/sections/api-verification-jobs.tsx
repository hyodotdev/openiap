import { Callout } from "../components/Callout";
import { CodeBlock } from "../components/CodeBlock";

export function VerificationJobsReference() {
  return (
    <section id="verification-jobs" className="scroll-mt-24">
      <h2 className="mt-10 text-2xl font-semibold">
        Queue a purchase verification
      </h2>
      <p>
        Use the optional job API when verification must survive a disconnected
        caller or a server restart. It accepts the same Apple, Google Play,
        Amazon and Horizon request bodies as synchronous verification. Existing
        SDK calls continue to use <code>/v1/purchase/verify</code>; integrate
        these job endpoints explicitly to use the queue.
      </p>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Generate 32 cryptographically random bytes, encoded as 64 lowercase
          hex characters. Keep this <code>Idempotency-Key</code> in private app
          storage before sending the request. It also protects result access;
          never log it or include it in a URL.
        </li>
        <li>
          Send <code>POST /v1/purchase/verification-jobs</code> with your
          publishable API key, the idempotency header and the usual evidence. A{" "}
          <code>202</code> response means the work was durably stored. Save the
          returned <code>jobId</code>. If the response is lost, repeat the same
          request and key to recover it.
        </li>
        <li>
          Read <code>GET /v1/purchase/verification-jobs/{"{jobId}"}</code>
          with the same API credential and idempotency header. Follow
          <code> Retry-After</code>, starting at two seconds for pending work,
          and increase the delay on repeated errors.
        </li>
      </ol>
      <CodeBlock title="Accept a Google Play verification" language="http">
        {`POST /v1/purchase/verification-jobs
Authorization: Bearer openiap-kit_pk_<your-publishable-key>
Idempotency-Key: <your-random-64-character-hex-key>
Content-Type: application/json

{"store":"google","purchaseToken":"<purchase-token>","expectedProductId":"premium.monthly"}

HTTP/1.1 202 Accepted
{"jobId":"<job-id>","deduped":false}`}
      </CodeBlock>
      <CodeBlock title="Read this job" language="http">
        {`GET /v1/purchase/verification-jobs/<job-id>
Authorization: Bearer openiap-kit_pk_<your-publishable-key>
Idempotency-Key: <the-same-random-key>

HTTP/1.1 200 OK
Retry-After: 2
{"jobId":"<job-id>","status":"queued","createdAt":1793005200000,"expiresAt":1793006100000}`}
      </CodeBlock>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <code>queued</code> and <code>running</code>: verification has no
          final answer yet. These are job states, separate from a store&apos;s
          pending payment.
        </li>
        <li>
          <code>succeeded</code>: <code>result</code> contains the usual
          verification response, including <code>isValid</code>. An invalid
          receipt is still a completed verification.
        </li>
        <li>
          <code>failed</code>: <code>error</code> records why processing
          stopped. Temporary failures retry up to five attempts; configuration
          or authentication failures stop without repeated store calls.
        </li>
        <li>
          <code>expired</code>: the job did not finish within 15 minutes. Do not
          treat expiry as a rejected payment.
        </li>
      </ul>
      <Callout kind="warning" title="Acceptance does not grant access">
        <p>
          Do not grant access or finish a transaction on <code>202</code>. Apply
          your existing confirmation and fulfillment policy after the final
          verdict. Verification alone does not bind a user or grant an
          entitlement. Keep fulfillment idempotent by the store-verified
          transaction identity. For the shared purchase flow, waiting can map to{" "}
          <code>verification_delayed</code> through your existing confirmer.
        </p>
      </Callout>
      <p>
        Results are retained for 24 hours after completion and describe the
        verdict at <code>completedAt</code>. Read current subscription access
        through the existing entitlement APIs. Within retention, retrying the
        same key and body returns the same job; changing the body returns
        <code> 409 IDEMPOTENCY_CONFLICT</code>. After retention, a POST can
        create a new verification. A wrong credential, request key or job id
        returns the same <code>404</code>.
      </p>
      <p>
        Shared capacity allows 128 active jobs per project, 1,024 overall, two
        concurrent workers per project and eight overall. A full queue returns{" "}
        <code>503 SERVICE_BUSY</code> before acceptance; admission or
        repeated-evidence limits return <code>429 RATE_LIMITED</code>. Queueing
        absorbs bursts and does not guarantee unlimited throughput. Evidence and
        encrypted credentials are removed from the queue at completion or
        expiry; verified purchase records follow their existing retention
        policy.
      </p>
    </section>
  );
}
