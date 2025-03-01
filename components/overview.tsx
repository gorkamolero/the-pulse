import { motion } from "framer-motion";

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
            <motion.div
              className="size-8 bg-foreground rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.7, 0.3, 0.7],
                boxShadow: [
                  "0 0 0 0 rgba(59, 130, 246, 0.7)",
                  "0 0 0 20px rgba(59, 130, 246, 0)",
                  "0 0 0 0 rgba(59, 130, 246, 0.7)"
                ]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
        </div>
        <h1 className="text-3xl font-bold">The Pulse</h1>
      </div>
    </motion.div>
  );
};
