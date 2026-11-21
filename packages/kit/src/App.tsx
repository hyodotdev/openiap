import { ScrollToTop } from "./components/ScrollToTop";
import { AuthTransition } from "./components/AuthTransition";
import { ConfigProvider, theme } from "antd";
import { useThemeMode } from "./hooks/useThemeMode";
import { useMixpanelIdentify } from "./hooks/useMixpanelIdentify";
import { ProductClientPayloadDialogRoot } from "./pages/auth/organization/project/ProductClientPayloadDialog";
import { useSignInReturn } from "./hooks/useSignInReturn";
import { useLocation } from "react-router-dom";
import CliAuthorize from "./pages/cli-authorize";
import OauthAuthorize from "./pages/oauth-authorize";

export default function App() {
  const location = useLocation();
  const { isDarkMode } = useThemeMode();
  useMixpanelIdentify();
  useSignInReturn();

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <ScrollToTop />
      {location.pathname === "/cli/authorize" ? (
        <CliAuthorize />
      ) : location.pathname === "/oauth/authorize" ? (
        <OauthAuthorize />
      ) : (
        <AuthTransition />
      )}
      <ProductClientPayloadDialogRoot />
    </ConfigProvider>
  );
}
