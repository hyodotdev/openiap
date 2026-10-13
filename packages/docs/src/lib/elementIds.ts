import { isValidElement } from 'react';

// Reads JSX `id` props, so it finds anchors in unmounted content but not ids hardcoded inside child components.
export function declaresId(node: unknown, id: string): boolean {
  if (!id || node === null || typeof node !== 'object') return false;
  if (isValidElement<{ id?: unknown; children?: unknown }>(node)) {
    return node.props.id === id || declaresId(node.props.children, id);
  }
  // Arrays, and slot objects such as the children of PlatformTabs.
  return Object.values(node).some((child) => declaresId(child, id));
}
