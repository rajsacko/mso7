import { notFound } from "next/navigation";
import { getBrandKit, getProject } from "@/lib/projects";
import { Studio } from "@/components/Studio";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function StudioPage({ params }: Props) {
  const { id } = await params;
  const [project, brand] = await Promise.all([getProject(id), getBrandKit()]);
  if (!project) notFound();

  return <Studio initialProject={project} initialBrand={brand} />;
}
