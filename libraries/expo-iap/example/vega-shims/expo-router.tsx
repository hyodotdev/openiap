import React, {createContext, useContext} from 'react';
import {TouchableOpacity} from 'react-native';

type RouterHref = string | {pathname?: string};

interface RouterShimNavigation {
  push(href: RouterHref): void;
  navigate(href: RouterHref): void;
  replace(href: RouterHref): void;
  back(): void;
}

interface RouterShimProviderProps {
  children: React.ReactNode;
  navigation: RouterShimNavigation;
}

interface LinkProps {
  asChild?: boolean;
  children: React.ReactNode;
  href: RouterHref;
}

interface StackProps {
  children?: React.ReactNode;
}

const inertNavigation: RouterShimNavigation = {
  push() {},
  navigate() {},
  replace() {},
  back() {},
};

const RouterShimContext =
  createContext<RouterShimNavigation>(inertNavigation);

export function ExpoRouterShimProvider({
  children,
  navigation,
}: RouterShimProviderProps): React.JSX.Element {
  return (
    <RouterShimContext.Provider value={navigation}>
      {children}
    </RouterShimContext.Provider>
  );
}

const normalizeHref = (href: RouterHref): string => {
  if (typeof href === 'string') return href;
  return href.pathname ?? '/';
};

export function Link({
  asChild,
  children,
  href,
}: LinkProps): React.JSX.Element {
  const navigation = useContext(RouterShimContext);

  const handlePress = () => {
    navigation.navigate(normalizeHref(href));
  };

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{onPress?: () => void}>;
    return React.cloneElement(child, {
      onPress: () => {
        child.props.onPress?.();
        handlePress();
      },
    });
  }

  return <TouchableOpacity onPress={handlePress}>{children}</TouchableOpacity>;
}

export function Slot(): null {
  return null;
}

function StackComponent({children}: StackProps): React.JSX.Element {
  return <>{children}</>;
}

StackComponent.Screen = function Screen(): null {
  return null;
};

export const Stack = StackComponent;

export const router: RouterShimNavigation = inertNavigation;

export const useRouter = (): RouterShimNavigation =>
  useContext(RouterShimContext);
