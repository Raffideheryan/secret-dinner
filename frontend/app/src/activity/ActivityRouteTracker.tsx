import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackLandingEvent } from "./tracker";

const trackedPaths = new Set(["/", "/legal", "/join", "/join/dinners"]);

export default function ActivityRouteTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!trackedPaths.has(location.pathname)) {
      return;
    }
    trackLandingEvent("page_view", {
      search: location.search,
      hash: location.hash,
    });
  }, [location.hash, location.pathname, location.search]);

  return null;
}
