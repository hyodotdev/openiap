const printed = new Set<string>();

// Log a message once per Node process, to stderr so tools that read the config
// as JSON from stdout stay intact.
export const logOnce = (msg: string): void => {
  if (printed.has(msg)) return;
  printed.add(msg);
  console.error(msg);
};
