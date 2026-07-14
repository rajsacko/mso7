import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { FORMAT_SIZES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await listProjects();

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

      {projects.length === 0 ? (
        <section>
          <p className="mso-page-kicker">Maison Sacko · Studio</p>
          <h1>MSO7</h1>
          <p className="lead">
            Upload clips. Lay text on the frame. Export a branded piece —
            without a heavy editor.
          </p>
          <div className="mso-page-actions">
            <Link href="/new" className="mso-export">
              New piece
            </Link>
            <Link href="/brand" className="mso-btn">
              Brand kit
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="mso-library-head">
            <div>
              <p className="mso-page-kicker">Library</p>
              <h1 style={{ fontSize: "2.75rem" }}>Your pieces</h1>
            </div>
            <Link href="/new" className="mso-export" style={{ width: 160 }}>
              New piece
            </Link>
          </div>
          <div className="mso-card-grid">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/studio/${project.id}`}
                className="mso-card"
              >
                <div>
                  <div className="mso-card-title">{project.title}</div>
                  <div className="mso-card-meta">
                    {FORMAT_SIZES[project.format].label}
                  </div>
                </div>
                <div className="mso-card-foot">
                  {project.clips.length} clip
                  {project.clips.length === 1 ? "" : "s"}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      <div className="mso-credit">
        <div>Product by Maison Sacko</div>
        <div className="light">Credit: Raj Sacko</div>
      </div>
    </div>
  );
}
