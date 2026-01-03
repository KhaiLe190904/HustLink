import { HTMLAttributes, useEffect, useState } from "react";
import { timeAgo } from "@/features/feed/utils/date";

interface TimeAgoProps extends HTMLAttributes<HTMLDivElement> {
  date: string;
  edited?: boolean;
}

export function TimeAgo({ date, edited, className, ...others }: TimeAgoProps) {
  const [time, setTime] = useState(timeAgo(new Date(date)));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(timeAgo(new Date(date)));
    }, 1000);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <div className={`text-gray-600 text-xs ${className || ""}`} {...others}>
      {" "}
      {/* color: #666, font-size: 12px */}
      <span>{time}</span>
      {edited ? <span>(Edited)</span> : null}
    </div>
  );
}
