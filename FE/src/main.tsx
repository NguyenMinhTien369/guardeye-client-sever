import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1a1a2e",
            color: "#f1f1f4",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            fontSize: "0.9rem",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#1a1a2e",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#1a1a2e",
            },
          },
        }}
      />
    </AuthProvider>
  </StrictMode>
);
