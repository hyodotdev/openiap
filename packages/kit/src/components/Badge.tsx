import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Star,
  Smartphone,
  Code2,
  Layers,
  Bot,
  MonitorSmartphone,
  Server,
  Braces,
  Box,
  Gamepad2,
  Globe,
  Sparkles,
} from "lucide-react";

export type BadgeVariant =
  | "default"
  | "popular"
  | "new"
  | "beta"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "outline";
export type BadgeSize = "xs" | "sm" | "md" | "lg";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground border-muted/50",
  popular:
    "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 dark:shadow-orange-500/20 border-transparent",
  new: "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 dark:shadow-green-500/20 border-transparent",
  beta: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25 dark:shadow-blue-500/20 border-transparent",
  primary:
    "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30",
  secondary: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  success:
    "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  warning:
    "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  danger:
    "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  outline: "bg-transparent text-foreground border-border",
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: "px-2 py-0.5 text-xs gap-1",
  sm: "px-2.5 py-1 text-xs gap-1.5",
  md: "px-3 py-1 text-sm gap-1.5",
  lg: "px-3.5 py-1.5 text-base gap-2",
};

const iconSizeStyles: Record<BadgeSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export function Badge({
  children,
  variant = "default",
  size = "sm",
  icon,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border transition-all duration-200",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
    >
      {icon && (
        <span className={cn("flex-shrink-0", iconSizeStyles[size])}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

// Legacy PopularBadge for backward compatibility
export function PopularBadge() {
  return (
    <Badge
      variant="popular"
      className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10"
      icon={<Star className="w-3.5 h-3.5 fill-current" />}
    >
      <span className="leading-none">{"Most Popular"}</span>
    </Badge>
  );
}

// Platform-specific badge component
interface PlatformBadgeProps {
  platform: string;
  size?: BadgeSize;
  className?: string;
}

type KnownPlatform =
  | "react-native"
  | "flutter"
  | "kmp"
  | "android"
  | "ios"
  | "node"
  | "php"
  | "dotnet"
  | "unity"
  | "web"
  | "other";

const platformDetailsMap: Record<
  KnownPlatform,
  { label: string; icon: ReactNode; variant: BadgeVariant }
> = {
  "react-native": {
    label: "React Native",
    icon: <Smartphone className="w-full h-full" />,
    variant: "primary",
  },
  flutter: {
    label: "Flutter",
    icon: <Layers className="w-full h-full" />,
    variant: "outline",
  },
  kmp: {
    label: "Kotlin MP",
    icon: <Code2 className="w-full h-full" />,
    variant: "secondary",
  },
  android: {
    label: "Android",
    icon: <Bot className="w-full h-full" />,
    variant: "success",
  },
  ios: {
    label: "iOS",
    icon: <MonitorSmartphone className="w-full h-full" />,
    variant: "beta",
  },
  node: {
    label: "Node.js",
    icon: <Server className="w-full h-full" />,
    variant: "warning",
  },
  php: {
    label: "PHP",
    icon: <Braces className="w-full h-full" />,
    variant: "outline",
  },
  dotnet: {
    label: ".NET",
    icon: <Box className="w-full h-full" />,
    variant: "primary",
  },
  unity: {
    label: "Unity",
    icon: <Gamepad2 className="w-full h-full" />,
    variant: "secondary",
  },
  web: {
    label: "Web",
    icon: <Globe className="w-full h-full" />,
    variant: "new",
  },
  other: {
    label: "Other",
    icon: <Sparkles className="w-full h-full" />,
    variant: "default",
  },
};

const isKnownPlatform = (value: string): value is KnownPlatform =>
  value in platformDetailsMap;

const fallbackPlatformDetails = (
  platform: string,
): { label: string; icon: ReactNode; variant: BadgeVariant } => ({
  label: platform,
  icon: null,
  variant: "default",
});

export function PlatformBadge({
  platform,
  size = "xs",
  className,
}: PlatformBadgeProps) {
  const details = isKnownPlatform(platform)
    ? platformDetailsMap[platform]
    : fallbackPlatformDetails(platform);

  const { label, icon, variant } = details;

  return (
    <Badge
      variant={variant}
      size={size}
      icon={icon}
      className={cn(
        "font-semibold shadow-sm hover:shadow-md transition-shadow",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export default Badge;
