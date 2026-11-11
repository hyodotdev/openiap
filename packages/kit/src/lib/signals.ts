import { signal } from "@preact/signals-react";
import type { Id } from "@/convex";

export const authModalSignal = signal({ isOpen: false });

export const openAuthModal = () => {
  authModalSignal.value = { isOpen: true };
};

export const closeAuthModal = () => {
  authModalSignal.value = { isOpen: false };
};

export type ProductClientPayloadEditorTarget = {
  projectId: Id<"projects">;
  platform: "IOS" | "Android";
  productId: string;
  title: string;
};

type ProductClientPayloadEditorState = {
  isOpen: boolean;
  instanceId: number;
  target: ProductClientPayloadEditorTarget | null;
};

export const productClientPayloadEditorSignal =
  signal<ProductClientPayloadEditorState>({
    isOpen: false,
    instanceId: 0,
    target: null,
  });

export const openProductClientPayloadEditor = (
  target: ProductClientPayloadEditorTarget,
) => {
  productClientPayloadEditorSignal.value = {
    isOpen: true,
    instanceId: productClientPayloadEditorSignal.value.instanceId + 1,
    target,
  };
};

export const closeProductClientPayloadEditor = () => {
  productClientPayloadEditorSignal.value = {
    isOpen: false,
    instanceId: productClientPayloadEditorSignal.value.instanceId,
    target: null,
  };
};
