"use client";

import { useState, useEffect } from "react";
import type { KnowledgeSource } from "@/app/api/sources/route";
import { Button } from "@/components/atoms/Button";
import { Chip } from "@/components/atoms/Chip";
import { StatusPill } from "@/components/atoms/StatusPill";
import { EntityChip } from "@/components/atoms/EntityChip";
import { Switch } from "@/components/atoms/Switch";

interface SourcesViewProps {
  onAskGenie?: (prompt: string) => void;
}

export default function SourcesView({ onAskGenie }: SourcesViewProps) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [totalChunks, setTotalChunks] = useState<number>(184);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"all" | "document" | "syllabus" | "policy" | "tables">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Upload modal / composer state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [docName, setDocName] = useState<string>("");
  const [docCategory, setDocCategory] = useState<string>("Guidelines & Rules");
  const [docType, setDocType] = useState<string>("document");
  const [docDesc, setDocDesc] = useState<string>("");
  const [docContent, setDocContent] = useState<string>("");
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  // Live RAG query test state
  const [ragQuery, setRagQuery] = useState<string>("");
  const [ragResults, setRagResults] = useState<KnowledgeSource[]>([]);
  const [isSearchingRag, setIsSearchingRag] = useState<boolean>(false);

  const fetchSources = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        setTables(data.tables || []);
        if (data.totalChunks) setTotalChunks(data.totalChunks);
      }
    } catch (e) {
      console.warn("Failed to load knowledge sources:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: docName,
          category: docCategory,
          type: docType,
          description: docDesc,
          content: docContent || docDesc,
          chunkCount: Math.floor(Math.random() * 24) + 12,
          fileSize: "1.2 MB",
          uploadedBy: "Campus Admin",
        }),
      });

      if (res.ok) {
        setUploadSuccess(true);
        setTimeout(() => {
          setUploadSuccess(false);
          setIsUploadOpen(false);
          setDocName("");
          setDocDesc("");
          setDocContent("");
          fetchSources();
        }, 800);
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleRagSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuery.trim()) return;

    setIsSearchingRag(true);
    try {
      const res = await fetch(`/api/sources?query=${encodeURIComponent(ragQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setRagResults(data.sources || []);
      }
    } catch (err) {
      console.error("RAG search error:", err);
    } finally {
      setIsSearchingRag(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (activeTab === "document" && s.type !== "document") return false;
    if (activeTab === "syllabus" && s.type !== "syllabus") return false;
    if (activeTab === "policy" && s.type !== "policy") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full space-y-4 max-w-5xl mx-auto p-4 sm:p-6 select-text">
      {/* Header & Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-[12px] border border-line bg-surface p-3 shadow-card space-y-1">
          <div className="text-[11.5px] font-medium text-ink-3 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" />
            <span>Indexed Documents</span>
          </div>
          <div className="text-[20px] font-bold text-ink">{sources.length}</div>
          <div className="text-[10.5px] text-ink-3">Grounded in Unity Catalog</div>
        </div>

        <div className="rounded-[12px] border border-line bg-surface p-3 shadow-card space-y-1">
          <div className="text-[11.5px] font-medium text-ink-3 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green" />
            <span>Vector Chunks</span>
          </div>
          <div className="text-[20px] font-bold text-ink">{totalChunks}</div>
          <div className="text-[10.5px] text-green">100% embeddings ready</div>
        </div>

        <div className="rounded-[12px] border border-line bg-surface p-3 shadow-card space-y-1">
          <div className="text-[11.5px] font-medium text-ink-3 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cyan-500" />
            <span>Governed Tables</span>
          </div>
          <div className="text-[20px] font-bold text-ink">{tables.length || 7}</div>
          <div className="text-[10.5px] text-ink-3">Delta Lakehouse schema</div>
        </div>

        <div className="rounded-[12px] border border-line bg-surface p-3 shadow-card space-y-1">
          <div className="text-[11.5px] font-medium text-ink-3 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-purple-500" />
            <span>Avg SQL Latency</span>
          </div>
          <div className="text-[20px] font-bold text-ink">42<span className="text-[12px] text-ink-3 font-normal">ms</span></div>
          <div className="text-[10.5px] text-purple-400">Serverless Warehouse</div>
        </div>
      </div>

      {/* Toolbar & Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-[12px] border border-line bg-surface p-2 shadow-card">
        {/* Category filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: "all", label: "All Sources" },
            { id: "document", label: "Handbooks & PDFs" },
            { id: "syllabus", label: "Syllabi" },
            { id: "policy", label: "Policies" },
            { id: "tables", label: "Delta Tables (7)" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`h-7 px-2.5 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-hover-2 text-ink shadow-hairline"
                  : "text-ink-3 hover:text-ink hover:bg-hover"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="search"
              placeholder="Search knowledge sources…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 rounded-[7px] border border-line bg-field px-2.5 text-[12px] text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadOpen((p) => !p)}
            className="flex items-center gap-1.5 h-7 px-3 text-[12px] whitespace-nowrap"
          >
            {isUploadOpen ? "✕ Close" : "+ Upload Document"}
          </Button>
        </div>
      </div>

      {/* Document Upload Drawer / Composer */}
      {isUploadOpen && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-[14px] border border-accent/40 bg-surface p-4 shadow-card space-y-3.5 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Upload Campus Knowledge Document</h3>
              <p className="text-[11.5px] text-ink-3">
                File contents will be chunked and indexed in Databricks Unity Catalog (<code className="text-accent-ink">workspace.campus_explorer.knowledge_sources</code>).
              </p>
            </div>
            <span className="text-[11px] text-accent-ink font-medium px-2 py-0.5 rounded-full bg-accent-tint">
              RAG Embeddings Auto-Generated
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-ink-2 mb-1">Document Title / File Name</label>
              <input
                type="text"
                required
                placeholder="e.g. CS301 Distributed Systems Syllabus.pdf"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12.5px] text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1">Category</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full h-8 rounded-[8px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                >
                  <option value="Guidelines & Rules">Guidelines &amp; Rules</option>
                  <option value="Curriculum">Curriculum</option>
                  <option value="Governance">Governance</option>
                  <option value="Lakehouse Reference">Lakehouse Reference</option>
                  <option value="Campus Life">Campus Life</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-ink-2 mb-1">Source Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full h-8 rounded-[8px] border border-line bg-field px-2 text-[12px] text-ink outline-none"
                >
                  <option value="document">PDF / Document</option>
                  <option value="syllabus">Course Syllabus</option>
                  <option value="policy">Policy / Senate</option>
                  <option value="technical">Technical Whitepaper</option>
                  <option value="dataset">JSON / CSV Feed</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-2 mb-1">Brief Description</label>
            <input
              type="text"
              placeholder="What this document contains and when students should consult it"
              value={docDesc}
              onChange={(e) => setDocDesc(e.target.value)}
              className="w-full h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12.5px] text-ink outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-ink-2 mb-1">Full Document Text / Sample Chunks</label>
            <textarea
              rows={3}
              placeholder="Paste raw markdown, policy rules, or syllabus schedule here for Lakehouse RAG indexing…"
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="w-full rounded-[8px] border border-line bg-field p-2.5 text-[12.5px] text-ink outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-line">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" className="flex items-center gap-1.5">
              {uploadSuccess ? "✓ Indexed in Lakehouse!" : "Index into Databricks"}
            </Button>
          </div>
        </form>
      )}

      {/* DELTA TABLES VIEW (When activeTab === 'tables') */}
      {activeTab === "tables" ? (
        <div className="space-y-3">
          <div className="text-[13px] font-semibold text-ink flex items-center justify-between">
            <span>Governed Unity Catalog Delta Tables ({tables.length})</span>
            <span className="text-[11.5px] text-ink-3">Catalog: workspace · Schema: campus_explorer</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {tables.map((tbl) => (
              <div
                key={tbl.name}
                className="rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:border-line-strong transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-accent" />
                    <code className="text-[13px] font-semibold text-ink font-mono">{tbl.name}</code>
                  </div>
                  <span className="text-[11px] font-medium text-ink-3 px-2 py-0.5 rounded-full bg-field border border-line">
                    {tbl.rowCount} rows · {tbl.type}
                  </span>
                </div>
                <p className="text-[12px] text-ink-2 leading-relaxed">{tbl.description}</p>
                <div className="flex items-center justify-between pt-1 text-[11px] text-ink-3 border-t border-line-soft">
                  <span>Delta Lake with CDF enabled</span>
                  <button
                    type="button"
                    onClick={() => onAskGenie?.(`Query the ${tbl.name} table and summarize the top 5 records.`)}
                    className="text-accent-ink hover:underline font-medium"
                  >
                    Query with Genie →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* KNOWLEDGE DOCUMENTS LIST */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px] font-semibold text-ink">
            <span>Campus Knowledge Documents ({filteredSources.length})</span>
            <span className="text-[11.5px] text-ink-3">Live RAG Context for Chat LLM</span>
          </div>

          <div className="space-y-2">
            {filteredSources.map((doc) => (
              <div
                key={doc.id}
                className="rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:border-line-strong transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-accent-tint text-accent-ink text-[13px]">
                      📄
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13.5px] font-semibold text-ink truncate">{doc.name}</h4>
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-hover text-ink-2 shrink-0">
                          {doc.category}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-ink-3 truncate">{doc.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-[10.5px] font-medium text-green">
                      <span className="size-1.5 rounded-full bg-green" />
                      {doc.status}
                    </span>
                    <span className="text-[11px] text-ink-3 font-mono">
                      {doc.chunkCount} chunks · {doc.fileSize}
                    </span>
                  </div>
                </div>

                {doc.contentSample && (
                  <div className="rounded-[8px] bg-canvas p-2.5 text-[12px] text-ink-2 font-mono leading-relaxed border border-line-soft line-clamp-2">
                    <span className="text-ink-3 font-sans font-medium mr-1.5">Excerpt:</span>
                    {doc.contentSample}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-[11px] text-ink-3 border-t border-line-soft">
                  <span>Uploaded by {doc.uploadedBy || "Campus Admin"}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onAskGenie?.(`According to "${doc.name}", what are the key policies and guidelines?`)}
                      className="text-accent-ink hover:underline font-medium"
                    >
                      Ask Genie about this document →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Lakehouse RAG Playground */}
      <div className="rounded-[14px] border border-line bg-surface p-4 shadow-card space-y-3 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-ink">Test Lakehouse Knowledge Retrieval</h3>
          </div>
          <span className="text-[11px] text-ink-3">Live RAG Sandbox</span>
        </div>

        <form onSubmit={handleRagSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="Try searching: 'hackathon rules', 'CS301 syllabus', 'pizza funding budget', 'dining hours'…"
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            className="flex-1 h-8 rounded-[8px] border border-line bg-field px-2.5 text-[12.5px] text-ink outline-none focus:border-accent"
          />
          <Button variant="primary" size="sm" type="submit" disabled={isSearchingRag} className="h-8 px-3.5">
            {isSearchingRag ? "Searching…" : "Retrieve Chunks"}
          </Button>
        </form>

        {ragResults.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-line animate-fade-in">
            <div className="text-[11.5px] font-medium text-ink-3">
              Matched {ragResults.length} relevant document(s) from Unity Catalog:
            </div>
            {ragResults.map((r) => (
              <div key={r.id} className="rounded-[8px] border border-line bg-canvas p-2.5 text-[12px] space-y-1">
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>{r.name}</span>
                  <span className="text-[10px] text-accent-ink">{r.category}</span>
                </div>
                <p className="text-ink-2 text-[11.5px]">{r.contentSample || r.description}</p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onAskGenie?.(`Using the knowledge source "${r.name}": ${r.contentSample || r.description}, answer this: ${ragQuery}`)}
                    className="text-[11px] text-accent-ink hover:underline font-medium"
                  >
                    Open in Chat with Genie →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
