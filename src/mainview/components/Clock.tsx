import React, { useEffect, useState } from "react";

export default function Clock() {
  const locale = "en";
  const [today, setDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDate(new Date());
    }, 60 * 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="flex font-semibold gap-2 items-center">
      {today.toLocaleTimeString(locale, { hour: "numeric", minute: "numeric" })}
    </div>
  );
}
