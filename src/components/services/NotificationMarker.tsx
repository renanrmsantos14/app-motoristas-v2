import type { AgendaItem } from "../../types";
import { SystemIcon } from "../icons/SystemIcon";

export function NotificationMarker({ priority = 0 }: { priority?: AgendaItem["priority"] }) {
  if (!priority) return null;

  if (priority === 1) {
    return (
      <div className="notification-marker warning">
        <SystemIcon name="warning" />
      </div>
    );
  }

  if (priority === 2) {
    return (
      <div className="notification-marker error">
        <SystemIcon name="error" />
      </div>
    );
  }

  if (priority === 3) {
    return <div className="notification-marker dot" />;
  }

  return (
    <div className="notification-marker money">
      <SystemIcon name="money" />
    </div>
  );
}
