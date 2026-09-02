"use client";

import PageFrame from "@/components/shared/PageFrame";
import CampusWrapped from "@/components/wrapped/CampusWrapped";

export default function WrappedPage() {
  return (
    <PageFrame title="Campus Wrapped · Semester Rewind" navKey="wrapped">
      <CampusWrapped />
    </PageFrame>
  );
}
