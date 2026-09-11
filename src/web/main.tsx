import { ThemeProvider, Toaster, TooltipProvider, toast } from "@nocoo/basalt";
import { AccentProvider } from "@nocoo/basalt/providers/accent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Preferences } from "../shared/contracts";
import { App } from "./App";
import { ApiError, api } from "./lib/api";
import "./styles.css";

const client = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
			refetchOnWindowFocus: true,
		},
	},
});
const root = document.getElementById("root");
if (!root) throw new Error("Application root missing");
createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={client}>
			<ThemeProvider
				defaultTheme="dark"
				storageKey="geekhub-theme"
				onThemeChange={(theme) => {
					const preferences = client.getQueryData<Preferences>(["preferences"]);
					if (preferences && theme !== preferences.theme)
						void api<Preferences>("/settings", { method: "PATCH", body: { theme } })
							.then((saved) => client.setQueryData(["preferences"], saved))
							.catch(() => toast.error("主题同步失败，请重试"));
				}}
			>
				<AccentProvider accent="green" persist={false}>
					<TooltipProvider>
						<App />
						<Toaster position="bottom-center" customAriaLabel="操作通知" />
					</TooltipProvider>
				</AccentProvider>
			</ThemeProvider>
		</QueryClientProvider>
	</StrictMode>,
);
