import { HTMLAttributes, useEffect, useState } from "react";
import classes from "./TimeAgo.module.scss";
import { timeAgo } from "@/features/feed/utils/date";

interface TimeAgoProps extends HTMLAttributes<HTMLDivElement> {
    date: string;
    edited?: boolean;
}

export function TimeAgo({date, edited, className, ...others}: TimeAgoProps) {
    const [time, setTime] = useState(timeAgo(new Date(date)));

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(timeAgo(new Date(date)));
        }, 1000);
        return () => clearInterval(interval);
    }, [date]);

    return <div className={`${classes.root} ${className || ""}`} {...others}>
        <span>{time}</span>
        {edited ? <span>(Edited)</span> : null}
        </div>
}
