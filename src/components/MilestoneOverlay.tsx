import { AnimatePresence, motion } from "motion/react";
import { SageActor } from "../hooks/sageActor";
import { selectMilestone } from "../machine/selectors";
import { MILESTONE_LEAD } from "../shared/milestone";
import { DiamondFrame } from "./DiamondCard";

const ease = [0.16, 1, 0.3, 1] as const;
/** Matches MILESTONE_RELEASE in the engine (after the white lead): text lands with the flash. */
const RELEASE = MILESTONE_LEAD + 1.9;

/** Text for the MILESTONE / SKILL ACQUIRED ceremony, in the gold register. */
export function MilestoneOverlay() {
  const milestone = SageActor.useSelector(selectMilestone);
  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          key={milestone.title + milestone.subtitle}
          className="milestone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)", transition: { duration: 0.9 } }}
        >
          <motion.p
            className="milestone__voice"
            initial={{ opacity: 0, clipPath: "inset(0 100% 0 0)" }}
            animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }}
            transition={{ delay: 0.3, duration: 0.7, ease }}
          >
            Notice. Skill acquired.
          </motion.p>
          <motion.div
            className="milestone__card"
            initial={{ opacity: 0, scale: 1.4, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: RELEASE, duration: 0.4, ease }}
          >
            <span className="milestone__kicker">ULTIMATE · SKILL</span>
            <DiamondFrame tone="gold">
              <span className="dcard__kanji dcard__kanji--n2 milestone__kanji">獲得</span>
            </DiamondFrame>
          </motion.div>
          <motion.div
            className="milestone__title"
            initial={{ opacity: 0, letterSpacing: "0.9em" }}
            animate={{ opacity: 1, letterSpacing: "0.32em" }}
            transition={{ delay: RELEASE + 0.2, duration: 1.1, ease }}
          >
            {milestone.title}
          </motion.div>
          <motion.div
            className="milestone__subtitle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: RELEASE + 0.6, duration: 0.7, ease }}
          >
            {milestone.subtitle}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
