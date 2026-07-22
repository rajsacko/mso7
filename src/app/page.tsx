import Link from "next/link";
import { LibraryGrid } from "@/components/LibraryGrid";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await listProjects();
  const pieces = projects.map((project) => ({
    id: project.id,
    title: project.title,
    format: project.format,
    clipCount: project.clips.length,
  }));

  return (
    <div className="mso-page">
      <div className="mso-page-header">
        <Link href="/" className="mso-logo">
          MSO7 <span className="beta">Beta</span>
        </Link>
        <nav className="mso-nav">
          <Link href="/new">New piece</Link>
          <Link href="/brand">Brand kit</Link>
        </nav>
      </div>

      {pieces.length === 0 ? (
        <section>
          <p className="mso-page-kicker">Maison Sacko · Studio</p>
          <h1>MSO7</h1>
          <p className="lead">
            Upload clips. Lay text on the frame. Export a branded piece —
            without a heavy editor.
          </p>
          <div className="mso-page-actions">
            <Link href="/new" className="mso-export">
              <span className="mso-export-label">New piece</span>
            </Link>
            <Link href="/brand" className="mso-btn">
              Brand kit
            </Link>
          </div>
        </section>
      ) : (
        <LibraryGrid projects={pieces} />
      )}

      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>
    </div>
  );
}
