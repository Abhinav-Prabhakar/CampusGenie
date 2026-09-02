"use client";

import PageFrame from "@/components/shared/PageFrame";
import AwardsView from "@/components/awards/AwardsView";

export default function AwardsPage() {
  return (
    <PageFrame title="Awards · Prize Distributions" navKey="awards">
      <AwardsView />
    </PageFrame>
  );
}
