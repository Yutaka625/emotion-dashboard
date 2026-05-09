import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import BaselineBanner from "./components/BaselineBanner";
import { BaselineProvider } from "./contexts/BaselineContext";
import { FaceIDProvider } from "./contexts/FaceIDContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { EventsProvider } from "./contexts/EventsContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <BaselineProvider>
          <FaceIDProvider>
            <EventsProvider>
            <TooltipProvider>
              <Toaster />
              {/* ベースライン補正中は画面上部にバナーを表示 */}
              <BaselineBanner />
              <Router />
            </TooltipProvider>
            </EventsProvider>
          </FaceIDProvider>
        </BaselineProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
