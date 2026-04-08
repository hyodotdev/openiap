declare module 'react-test-renderer' {
  export function act(
    callback: () => void | Promise<void>,
  ): void | Promise<void>;
  const TestRenderer: any;
  export default TestRenderer;
}
