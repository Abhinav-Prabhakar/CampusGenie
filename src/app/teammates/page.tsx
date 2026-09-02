"use client";

import PageFrame from "@/components/shared/PageFrame";
import TeammateMatcher from "@/components/teammates/TeammateMatcher";

export default function TeammatesPage() {
  return (
    <PageFrame title="Teammates · Campus Matcher" navKey="teammates">
      <TeammateMatcher />
    </PageFrame>
  );
}
