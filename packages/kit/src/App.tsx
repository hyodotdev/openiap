import { ScrollToTop } from "./components/ScrollToTop";
import { AuthTransition } from "./components/AuthTransition";
import { useEffect } from "react";
import { ConfigProvider, theme } from "antd";
import { useThemeMode } from "./hooks/useThemeMode";
import { useMixpanelIdentify } from "./hooks/useMixpanelIdentify";

export default function App() {
  const { isDarkMode } = useThemeMode();
  useMixpanelIdentify();

  useEffect(() => {
    if (!document.body) {
      return;
    }
    document.body.style.backgroundColor = isDarkMode ? "#18181B" : "#fefefe";
  }, [isDarkMode]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <ScrollToTop />
      <AuthTransition />
    </ConfigProvider>
  );
}
