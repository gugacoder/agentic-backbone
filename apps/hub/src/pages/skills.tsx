import { useQuery } from "@tanstack/react-query";
import { skillsQuery, useDeleteSkill } from "@/api/skills";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

export function SkillsPage() {
  const { data: skills, isLoading } = useQuery(skillsQuery);
  const deleteSkill = useDeleteSkill();
  const [deleteTarget, setDeleteTarget] = useState<{ scope: string; slug: string } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Skills" description={`${skills?.length ?? 0} skill(s) available`} />

      {!skills?.length ? (
        <EmptyState icon={Sparkles} title="No skills" description="No skills configured yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <Card key={`${skill.source}-${skill.slug}`} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{String(skill.metadata.name ?? skill.slug)}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setDeleteTarget({ scope: skill.source, slug: skill.slug })}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{String(skill.metadata.description ?? "")}</p>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{skill.source}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Skill" description={`Delete skill ${deleteTarget?.slug}?`} confirmText="Delete" variant="destructive" onConfirm={() => { if (deleteTarget) deleteSkill.mutate(deleteTarget); }} />
    </div>
  );
}
