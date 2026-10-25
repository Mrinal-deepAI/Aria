import { useState, useEffect } from "react";
import { motion } from "motion/react";

export function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatterTime = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formatterDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }}
      className="absolute bottom-6 right-[66px] z-50 py-2.5 px-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center pointer-events-none w-64"
    >
      <div className="text-2xl font-bold text-white tracking-wide">
        {formatterTime.format(time)}
      </div>
      <div className="text-xs font-medium text-slate-300 mt-0.5">
        {formatterDate.format(time)}
      </div>
    </motion.div>
  );
}
