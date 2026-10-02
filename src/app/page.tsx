"use client";

import { Intake } from "@/screens/Intake";
import { useSession } from "@/state/SessionProvider";

export default function IntakePage() {
  const {
    state,
    publicDemo,
    sessionNotice,
    handleStartBundled,
    handleStartUpload,
  } = useSession();

  if (state.phase !== "intake") {
    return null;
  }

  return (
    <Intake
      publicDemo={publicDemo}
      sessionNotice={sessionNotice}
      onStartBundled={handleStartBundled}
      onStartUpload={handleStartUpload}
    />
  );
}
