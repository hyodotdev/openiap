function Operators() {
  return (
    <div className="doc-page">
      <h1>Operators</h1>
      
      <section>
        <h2>Overview</h2>
        <p>
          Operators are functions that allow you to manipulate and transform purchase streams. 
          They enable powerful composition patterns for handling complex purchase flows.
        </p>
      </section>

      <section>
        <h2>Creation Operators</h2>
        
        <h3>create</h3>
        <pre className="code-block">{`IAP.create(observer => {
  observer.next(purchaseData)
  observer.complete()
})`}</pre>

        <h3>from</h3>
        <pre className="code-block">{`IAP.from(['product1', 'product2', 'product3'])
  .pipe(
    mergeMap(id => iapl.purchase(id))
  )`}</pre>

        <h3>of</h3>
        <pre className="code-block">{`IAP.of({ productId: 'premium', price: 9.99 })`}</pre>
      </section>

      <section>
        <h2>Transformation Operators</h2>
        
        <h3>map</h3>
        <pre className="code-block">{`purchase.pipe(
  map(result => ({
    ...result,
    timestamp: Date.now()
  }))
)`}</pre>

        <h3>filter</h3>
        <pre className="code-block">{`purchases.pipe(
  filter(purchase => purchase.status === 'successful')
)`}</pre>

        <h3>mergeMap</h3>
        <pre className="code-block">{`productIds.pipe(
  mergeMap(id => iapl.purchase(id))
)`}</pre>
      </section>

      <section>
        <h2>Error Handling Operators</h2>
        
        <h3>catchError</h3>
        <pre className="code-block">{`purchase.pipe(
  catchError(error => {
    logError(error)
    return IAP.of(defaultValue)
  })
)`}</pre>

        <h3>retry</h3>
        <pre className="code-block">{`purchase.pipe(
  retry(3) // Retry up to 3 times
)`}</pre>

        <h3>retryWhen</h3>
        <pre className="code-block">{`purchase.pipe(
  retryWhen(errors =>
    errors.pipe(
      delay(1000), // Wait 1 second between retries
      take(3)      // Maximum 3 retries
    )
  )
)`}</pre>
      </section>

      <section>
        <h2>Utility Operators</h2>
        
        <h3>tap</h3>
        <pre className="code-block">{`purchase.pipe(
  tap(result => console.log('Purchase result:', result)),
  tap(result => analytics.track('purchase', result))
)`}</pre>

        <h3>delay</h3>
        <pre className="code-block">{`purchase.pipe(
  delay(2000) // Delay emission by 2 seconds
)`}</pre>

        <h3>timeout</h3>
        <pre className="code-block">{`purchase.pipe(
  timeout(30000) // Timeout after 30 seconds
)`}</pre>
      </section>

      <section>
        <h2>Combination Operators</h2>
        
        <h3>merge</h3>
        <pre className="code-block">{`IAP.merge(
  iapl.purchase('product1'),
  iapl.purchase('product2')
)`}</pre>

        <h3>combineLatest</h3>
        <pre className="code-block">{`IAP.combineLatest([
  userProfile$,
  availableProducts$
]).pipe(
  map(([user, products]) => 
    products.filter(p => p.tier <= user.tier)
  )
)`}</pre>
      </section>
    </div>
  )
}

export default Operators