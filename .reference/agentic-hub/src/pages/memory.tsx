import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { agentsQuery } from "@/api/agents";
import { memoryStatusQuery, memoryChunksQuery, useSearchMemory, useSyncMemory, useResetMemory } from "@/api/memory";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Search, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { MemorySearchResult } from "@/api/types";

export function MemoryPage() {
  const { agent: selectedAgent, tab, q: searchQuery } = useSearch({ strict: false }) as { agent: string; tab: string; q: string };
  const navigate = useNavigate({ from: "/memory" });

  const { data: agents } = useQuery(agentsQuery);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[]>([]);

  const { data: status } = useQuery(memoryStatusQuery(selectedAgent));
  const { data: chunks } = useQuery(memoryChunksQuery(selectedAgent));
  const searchMemory = useSearchMemory();
  const syncMemory = useSyncMemory();
  const resetMemory = useResetMemory();

  const setSelectedAgent = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, agent: value }), replace: true });
  };

  const setTab = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, tab: value }), replace: true });
  };

  const setSearchQuery = (value: string) => {
    navigate({ search: (prev) => ({ ...prev, q: value }), replace: true });
  };

  const handleSearch = () => {
    if (!selectedAgent || !searchQuery) return;
    searchMemory.mutate(
      { agentId: selectedAgent, query: searchQuery },
      { onSuccess: (data) => setSearchResults(data) }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Memory" description="Semantic memory search and management" />

      <div className="flex items-center gap-4">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Select agent..." />
          </SelectTrigger>
          <SelectContent>
            {agents?.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAgent && status && (
          <div className="text-sm text-muted-foreground">
            {status.fileCount} files, {status.chunkCount} chunks
          </div>
        )}
      </div>

      {selectedAgent && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="browse">Browse Chunks</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search memory..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              <Button onClick={handleSearch} disabled={searchMemory.isPending}>
                <Search className="h-4 w-4 mr-2" /> Search
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-3">
                {searchResults.map((r, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{r.citation}</span>
                        <span className="text-xs font-mono">score: {r.score.toFixed(3)}</span>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">{r.snippet}</pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="browse">
            {chunks?.length ? (
              <div className="space-y-2">
                {chunks.map((chunk) => (
                  <Card key={chunk.id} className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">{chunk.path} (lines {chunk.startLine}-{chunk.endLine})</div>
                    <pre className="text-sm whitespace-pre-wrap line-clamp-4">{chunk.text}</pre>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No chunks indexed yet.</p>
            )}
          </TabsContent>

          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardContent className="pt-4 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => syncMemory.mutate(selectedAgent)} disabled={syncMemory.isPending}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Force Sync
                </Button>
                <Button variant="destructive" onClick={() => resetMemory.mutate(selectedAgent)} disabled={resetMemory.isPending}>
                  <Trash2 className="h-4 w-4 mr-2" /> Reset Memory
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
