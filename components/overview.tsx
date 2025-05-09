import { motion } from "framer-motion";
import { Pulse } from "./ui/pulse";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <div className="flex flex-col items-center gap-4">
            <Pulse />
        </div>
        <h1 className="text-3xl font-bold">The Pulse</h1>
      </div>
    </motion.div>
  );
};
