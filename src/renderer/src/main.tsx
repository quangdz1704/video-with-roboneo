import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { createBrowserMock } from "./lib/browserMock";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

if (!window.roboneo) window.roboneo = createBrowserMock();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <HashRouter>
      <App />
    </HashRouter>
  </AppErrorBoundary>,
);
