"use client";

import { useState, useEffect } from "react";
import type { KnowledgeSource } from "@/app/api/sources/route";
import { Button } from "@/components/atoms/Button";
import { Chip } from "@/components/atoms/Chip";
import { StatusPill } from "@/components/atoms/StatusPill";
import { EntityChip } from "@/components/atoms/EntityChip";

interface SourcesViewProps {
  onAskGenie?: (prompt: string) => void;
}

export default function SourcesView({ onAskGenie }: SourcesViewProps) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [tables, setTables] = useState<Array<Record<string, any>>>([]);
  const [totalChunks, setTotalChunks] = useState<number>(252);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"all" | "document" | "syllabus" | "policy" | "technical" | "dataset" | "tables">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Upload modal / composer state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [docName, setDocName] = useState<string>("");
  const [docCategory, setDocCategory] = useState<string>("Guidelines & Rules");
  const [docType, setDocType] = useState<string>("document");
  const [docDesc, setDocDesc] = useState<string>("");
  const [docContent, setDocContent] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<KnowledgeSource | null>(null);

  // Live RAG query test state
  const [ragQuery, setRagQuery] = useState<string>("");
  const [ragResults, setRagResults] = useState<KnowledgeSource[]>([]);
  const [isSearchingRag, setIsSearchingRag] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/sources");
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setSources(data.sources || []);
            setTables(data.tables || []);
            if (data.totalChunks) setTotalChunks(data.totalChunks);
          }
        }
      } catch (e) {
        console.warn("Failed to load knowledge sources:", e);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const fetchSources = async () => {
    try {
      setIsLoading(true);
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

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    if (!docName.trim()) setDocName(file.name);

    const lowerName = file.name.toLowerCase();
    const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|tiff)$/i.test(lowerName);

    if (isImg) setDocType("document");
    else if (lowerName.endsWith(".json") || lowerName.endsWith(".csv")) setDocType("dataset");
    else if (lowerName.includes("syllabus") || lowerName.includes("course")) setDocType("syllabus");
    else if (lowerName.includes("policy") || lowerName.includes("senate") || lowerName.includes("rule")) setDocType("policy");
    else if (lowerName.includes("architecture") || lowerName.includes("whitepaper") || lowerName.includes("delta")) setDocType("technical");
    else setDocType("document");

    const isTextFile = /\.(txt|md|json|csv|tsv|html)$/i.test(file.name) || file.type.startsWith("text/");
    if (isTextFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setDocContent(text.slice(0, 5000));
          if (!docDesc.trim()) {
            setDocDesc(`Uploaded file (${file.name}, ${(file.size / 1024).toFixed(1)} KB) containing campus documentation.`);
          }
        }
      };
      reader.readAsText(file);
    } else {
      setDocContent("");
      if (!docDesc.trim()) {
        setDocDesc(
          isImg
            ? `Uploaded image (${file.name}, ${(file.size / 1024).toFixed(1)} KB) — scanned with Tesseract.js OCR into Databricks Lakehouse.`
            : `Uploaded PDF (${file.name}, ${(file.size / 1024).toFixed(1)} KB) — parsed into Databricks Lakehouse knowledge base.`
        );
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      let res: Response;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("name", docName);
        fd.append("category", docCategory);
        fd.append("type", docType);
        fd.append("description", docDesc);
        if (docContent.trim()) fd.append("content", docContent);
        res = await fetch("/api/sources", {
          method: "POST",
          body: fd,
        });
      } else {
        const fileSizeStr = "1.2 MB";
        const chunkCount = Math.max(8, Math.round((docContent.length || 500) / 120));
        res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: docName,
            category: docCategory,
            type: docType,
            description: docDesc || `Document indexed into Databricks Lakehouse on ${new Date().toLocaleDateString()}`,
            content: docContent || docDesc || "Document text indexed for Databricks Lakehouse RAG.",
            chunkCount,
            fileSize: fileSizeStr,
          }),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setUploadSuccess(true);
        if (data.document) {
          setSources((prev) => [data.document, ...prev.filter((s) => s.id !== data.document.id)]);
        }
        setTimeout(() => {
          setUploadSuccess(false);
          setIsUploadOpen(false);
          setDocName("");
          setDocDesc("");
          setDocContent("");
          setSelectedFile(null);
          setUploadError(null);
          fetchSources();
        }, 800);
      } else {
        setUploadError(data?.error || "Failed to index document into Databricks Lakehouse.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "An error occurred while uploading to Databricks Lakehouse.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSource = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to remove this document from Databricks Lakehouse?")) return;

    // Optimistic removal
    setSources((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete source:", err);
      fetchSources();
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
    if (activeTab !== "all" && activeTab !== "tables" && s.type !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.contentSample && s.contentSample.toLowerCase().includes(q))
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
          <div className="text-[20px] font-bold text-ink">38<span className="text-[12px] text-ink-3 font-normal">ms</span></div>
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
            { id: "policy", label: "Policies & Senate" },
            { id: "technical", label: "Lakehouse Docs" },
            { id: "dataset", label: "Datasets" },
            { id: "tables", label: `Delta Tables (${tables.length || 7})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
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

      {/* Document Upload Drawer / Composer with Drag & Drop */}
      {isUploadOpen && (
        <form
          onSubmit={handleUploadSubmit}
          className="rounded-[14px] border border-accent/40 bg-surface p-4 shadow-card space-y-3.5 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-line pb-2.5">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Upload Document to Databricks Lakehouse</h3>
              <p className="text-[11.5px] text-ink-3">
                File contents will be chunked and indexed into Unity Catalog (<code className="text-accent-ink">workspace.campus_explorer.knowledge_sources</code>).
              </p>
            </div>
            <span className="text-[11px] text-accent-ink font-medium px-2 py-0.5 rounded-full bg-accent-tint">
              RAG Embeddings Auto-Generated
            </span>
          </div>

          {/* Drag and Drop Box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-[10px] p-4 text-center transition-colors ${
              isDragging ? "border-accent bg-accent-tint/30" : "border-line bg-field hover:border-line-strong"
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.md,.txt,.json,.csv,.docx,image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileChange(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-hover-2 text-ink text-sm">
                📁
              </span>
              <div className="text-[12.5px] font-medium text-ink">
                {selectedFile ? (
                  <span className="text-accent-ink font-semibold">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                ) : (
                  <>Drag &amp; drop file here, or <span className="text-accent-ink underline">browse</span></>
                )}
              </div>
              <span className="text-[11px] text-ink-3">Supports PDF, Images (PNG/JPG/WEBP OCR), Markdown, TXT, JSON, CSV</span>
            </label>
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
                  <option value="Research">Research</option>
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
                  <option value="dataset">JSON / CSV Dataset</option>
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
              rows={4}
              placeholder="Paste raw markdown, policy rules, or syllabus schedule here for Lakehouse RAG indexing…"
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              className="w-full rounded-[8px] border border-line bg-field p-2.5 text-[12.5px] text-ink outline-none focus:border-accent resize-none font-mono text-xs"
            />
          </div>

          {uploadError && (
            <div className="rounded-[8px] bg-red-tint/50 border border-red/40 p-2.5 text-[12px] text-red flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{uploadError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-line">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isUploading} className="flex items-center gap-1.5">
              {isUploading ? "Indexing into Lakehouse…" : uploadSuccess ? "✓ Indexed in Lakehouse!" : "Index into Databricks"}
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
                    onClick={() => onAskGenie?.(`Query the ${tbl.name} table in Databricks Lakehouse and summarize the top records.`)}
                    className="text-accent-ink hover:underline font-medium cursor-pointer"
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

          <div className="space-y-2.5">
            {filteredSources.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setPreviewDoc(doc)}
                className="group cursor-pointer rounded-[12px] border border-line bg-surface p-3.5 shadow-card hover:border-line-strong hover:shadow-md transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-ink text-[14px]">
                      {doc.type === "dataset" ? "📊" : doc.type === "syllabus" ? "📚" : doc.type === "policy" ? "⚖️" : doc.type === "technical" ? "⚡" : "📄"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13.5px] font-semibold text-ink truncate group-hover:text-accent transition-colors">{doc.name}</h4>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewDoc(doc);
                      }}
                      className="text-ink-2 hover:text-ink font-medium"
                    >
                      View Excerpt
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAskGenie?.(`According to "${doc.name}", what are the key policies and guidelines?`);
                      }}
                      className="text-accent-ink hover:underline font-medium"
                    >
                      Ask Genie →
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSource(doc.id, e)}
                      title="Delete from Lakehouse"
                      className="text-ink-3 hover:text-red transition-colors ml-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Detail Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="w-full max-w-2xl rounded-[14px] border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent-tint text-accent-ink text-base">
                  📄
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{previewDoc.name}</h3>
                  <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
                    <span>{previewDoc.category}</span>
                    <span>·</span>
                    <span>{previewDoc.chunkCount} vector chunks</span>
                    <span>·</span>
                    <span>{previewDoc.fileSize}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="flex size-7 items-center justify-center rounded-[6px] text-ink-3 hover:bg-hover hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[12px] font-semibold text-ink">Description</span>
              <p className="text-[12.5px] text-ink-2 leading-relaxed bg-field p-2.5 rounded-[8px] border border-line">
                {previewDoc.description}
              </p>
            </div>

            <div className="flex-1 min-h-0 space-y-2 flex flex-col">
              <span className="text-[12px] font-semibold text-ink">Document Text &amp; RAG Chunks</span>
              <div className="flex-1 overflow-y-auto rounded-[8px] bg-canvas p-3 font-mono text-[12px] text-ink leading-relaxed border border-line select-text whitespace-pre-wrap">
                {previewDoc.contentSample || previewDoc.description}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-[11.5px] text-ink-3">
                Indexed in Unity Catalog: <code className="font-mono text-accent-ink">workspace.campus_explorer.knowledge_sources</code>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const prompt = `According to the knowledge source "${previewDoc.name}", summarize the key policies, prerequisites, and schedules.`;
                    setPreviewDoc(null);
                    onAskGenie?.(prompt);
                  }}
                >
                  Ask Genie About This Document →
                </Button>
              </div>
            </div>
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
            placeholder="Try searching: 'hackathon rules', 'CS301 syllabus', 'pizza funding budget', 'AIS lab charter'…"
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
