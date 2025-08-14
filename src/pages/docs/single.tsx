function Single() {
  return (
    <div className="doc-page">
      <h1>Single</h1>
      
      <section>
        <h2>Overview</h2>
        <p>
          A Single is a specialized Observable that emits exactly one value or an error. 
          It's perfect for one-time purchase operations that either succeed with a result 
          or fail with an error.
        </p>
      </section>

      <section>
        <h2>Creating Singles</h2>
        <pre className="code-block">{`import { Single } from '@openiap/core'

// Create a Single for a purchase
const purchase = Single.create(observer => {
  processPurchase()
    .then(result => {
      observer.next(result)
      observer.complete()
    })
    .catch(error => {
      observer.error(error)
    })
})

// From a Promise
const purchaseSingle = Single.fromPromise(
  purchaseAPI.buy('premium')
)`}</pre>
      </section>

      <section>
        <h2>Single vs Observable</h2>
        <p>
          Singles are ideal for purchase operations because:
        </p>
        <ul>
          <li>A purchase either succeeds or fails (no multiple emissions)</li>
          <li>Simplified API for single-value operations</li>
          <li>Automatic completion after emission</li>
          <li>Better type inference for single values</li>
        </ul>
      </section>

      <section>
        <h2>Common Patterns</h2>
        
        <h3>Purchase with Verification</h3>
        <pre className="code-block">{`const purchaseAndVerify = (productId: string) =>
  Single.create(observer => {
    iapl.purchase(productId)
      .pipe(
        mergeMap(receipt => iapl.verify(receipt)),
        map(verification => ({
          receipt,
          verification,
          timestamp: Date.now()
        }))
      )
      .subscribe({
        next: result => {
          observer.next(result)
          observer.complete()
        },
        error: err => observer.error(err)
      })
  })`}</pre>

        <h3>Chaining Singles</h3>
        <pre className="code-block">{`purchaseSingle
  .pipe(
    flatMap(purchase => verifySingle(purchase.receipt)),
    flatMap(verification => unlockContentSingle(verification))
  )
  .subscribe({
    next: result => console.log('Content unlocked:', result),
    error: err => console.error('Process failed:', err)
  })`}</pre>
      </section>

      <section>
        <h2>Error Recovery</h2>
        <pre className="code-block">{`purchaseSingle
  .pipe(
    catchError(error => {
      if (error.recoverable) {
        return Single.of(defaultPurchase)
      }
      return Single.error(error)
    })
  )`}</pre>
      </section>

      <section>
        <h2>Converting to Observable</h2>
        <pre className="code-block">{`// Single to Observable
const observable = purchaseSingle.toObservable()

// Observable to Single (takes first emission)
const single = observable.pipe(
  take(1),
  toSingle()
)`}</pre>
      </section>
    </div>
  )
}

export default Single