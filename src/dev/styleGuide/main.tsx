import React from "react";
import ReactDOM from "react-dom/client";

import "../../App.css";
import { ThemeProvider } from "../../context/ThemeContext";
import { i18nReady } from "../../i18n";
import { readHarnessLanguage, readHarnessPage } from "../pageHarness/harnessPage";
import { readShellPreview } from "../shellPreview/readShellPreview";
import { readMatchPreview } from "../matchPreview/readMatchPreview";
import { StyleGuide } from "./StyleGuide";
import { applyStyleGuideOptions, readStyleGuideOptions } from "./styleGuideOptions";

const options = readStyleGuideOptions(window.location.search);
applyStyleGuideOptions(options, document.documentElement, localStorage);

const rootElement = document.getElementById("root");
const page = readHarnessPage(window.location.search);
const shellPreview = readShellPreview(window.location.search);
const matchPreview = readMatchPreview(window.location.search);

if (rootElement && page) {
  // ?page= mounts a real page on the fixture career instead of the guide (src/dev/pageHarness).
  void i18nReady
    .then(() => import("../pageHarness/mount"))
    .then(({ mountPageHarness }) =>
      mountPageHarness(rootElement, page, options, readHarnessLanguage(window.location.search)),
    );
} else if (rootElement && shellPreview) {
  // ?preview=shell draws the game shell and Home on a preview career: no save, no backend.
  void i18nReady
    .then(async () => {
      const { mockIPC } = await import("@tauri-apps/api/mocks");
      const { installShellPreviewIpc } = await import("../shellPreview/previewIpc");
      installShellPreviewIpc(mockIPC);
      const { ShellPreview } = await import("../shellPreview/ShellPreview");
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <ThemeProvider>
            <ShellPreview />
          </ThemeProvider>
        </React.StrictMode>,
      );
    })
    .catch((error: unknown) => {
      console.error("The shell preview could not start:", error);
    });
} else if (rootElement && matchPreview) {
  // ?preview=match draws the live match screen on a preview match: no backend session needed.
  void i18nReady
    .then(async () => {
      const { mockIPC } = await import("@tauri-apps/api/mocks");
      const { installMatchPreviewIpc } = await import("../matchPreview/previewMatchIpc");
      installMatchPreviewIpc(mockIPC);
      const { MatchPreview } = await import("../matchPreview/MatchPreview");
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <ThemeProvider>
            <MatchPreview />
          </ThemeProvider>
        </React.StrictMode>,
      );
    })
    .catch((error: unknown) => {
      console.error("The match preview could not start:", error);
    });
} else if (rootElement) {
  // The guide draws real position badges and rating chips, so the tables they read are stubbed too.
  void i18nReady
    .then(async () => {
      const { mockIPC } = await import("@tauri-apps/api/mocks");
      const { installStyleGuideIpc } = await import("./styleGuideIpc");
      installStyleGuideIpc(mockIPC);
      ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
          <ThemeProvider>
            <StyleGuide options={options} />
          </ThemeProvider>
        </React.StrictMode>,
      );
    })
    .catch((error: unknown) => {
      console.error("The style guide could not start:", error);
    });
}
