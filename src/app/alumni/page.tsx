"use client";

import PageFrame from "@/components/shared/PageFrame";
import AlumniConnectView from "@/components/alumni/AlumniConnectView";

export default function AlumniPage() {
  return (
    <PageFrame title="Alumni Connect · Career Pathways" navKey="alumni">
      <AlumniConnectView />
    </PageFrame>
  );
}
