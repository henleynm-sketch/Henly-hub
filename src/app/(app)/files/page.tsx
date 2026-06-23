import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { storeFileBinary, setFileVisibility, deleteFile, getFileById } from "@/lib/services/fileService";
import { deleteObject } from "@/lib/storage";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects, isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";

const KINDS = ["CONTRACT", "PLAN", "PERMIT", "INVOICE", "PHOTO", "OTHER"] as const;
// Subs get working drawings and site media, never client financial paper.
const SUB_KINDS = ["PLAN", "PERMIT", "PHOTO", "OTHER"];

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "documents");

function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function kindDot(kind: string) {
  return {
    CONTRACT: "hh-dot--purple",
    PLAN: "hh-dot--blue",
    PERMIT: "hh-dot--orange",
    INVOICE: "hh-dot--red",
    PHOTO: "hh-dot--green",
  }[kind] ?? "bg-slate-400";
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; projectId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  const clientId = session.user.clientId;

  const sp = await searchParams;
  const kindFilter = sp.kind && (KINDS as readonly string[]).includes(sp.kind) ? sp.kind : undefined;

  const projectWhere = canViewAllProjects(role)
    ? {}
    : role === "CLIENT" && clientId
    ? { clientId }
    : { assignments: { some: { userId } } };

  const docWhere: any = {};
  if (kindFilter) docWhere.kind = kindFilter;
  if (role === "CLIENT") docWhere.clientVisible = true;
  if (role === "SUB") docWhere.kind = kindFilter && SUB_KINDS.includes(kindFilter) ? kindFilter : { in: SUB_KINDS };

  const projects = await prisma.project.findMany({
    where: projectWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      documents: {
        where: docWhere,
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: true },
      },
      dailyLogs: {
        where: role === "CLIENT" ? { clientVisible: true, photos: { not: null } } : { photos: { not: null } },
        orderBy: { date: "desc" },
        take: 12,
        select: { id: true, photos: true },
      },
    },
  });

  const totalDocs = projects.reduce((a, p) => a + p.documents.length, 0);
  const canUpload = role === "CEO" || role === "OFFICE" || role === "FIELD";
  const canManage = role === "CEO" || role === "OFFICE";

  async function uploadDocuments(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE" && r !== "FIELD") return;

    const projectId = String(formData.get("projectId") || "");
    const kind = String(formData.get("kind") || "OTHER");
    if (!projectId || !(KINDS as readonly string[]).includes(kind)) return;

    if (r === "FIELD") {
      const assigned = await prisma.projectAssignment.findFirst({
        where: { projectId, userId: me.user.id },
      });
      if (!assigned) return;
    }

    const files = formData.getAll("files") as File[];
    if (!files.length) return;
    const clientVisible = formData.get("clientVisible") === "on";

    for (const file of files) {
      if (!file || file.size === 0) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      // storeFileBinary routes to S3/R2 when configured, else local disk.
      await storeFileBinary({
        projectId,
        name: file.name,
        kind,
        bytes: buffer,
        mimeType: file.type || null,
        sizeBytes: file.size,
        clientVisible,
        uploadedById: me.user.id,
      });
    }
    revalidatePath("/files");
  }

  async function toggleVisibility(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE") return;
    const id = String(formData.get("id") || "");
    const doc = await getFileById(id).catch(() => null);
    if (!doc) return;
    await setFileVisibility(id, !doc.clientVisible);
    revalidatePath("/files");
  }

  async function deleteDocument(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE") return;
    const id = String(formData.get("id") || "");
    const doc = await deleteFile(id).catch(() => null);
    if (!doc) return;
    if (doc.storageKey) {
      // Best-effort: a dangling object is not worth failing the deletion.
      await deleteObject(doc.storageKey).catch(() => {});
    } else if (doc.url.startsWith("/uploads/documents/")) {
      const filePath = path.join(UPLOAD_DIR, path.basename(doc.url));
      try {
        await unlink(filePath);
      } catch {
        // Row is gone; a missing file on disk is not worth failing the action.
      }
    }
    revalidatePath("/files");
  }

  function filterHref(kind?: string) {
    return kind ? `/files?kind=${kind}` : "/files";
  }

  return (
    <>
      <PageHeader
        title="Files"
        subtitle={
          role === "CLIENT"
            ? "Documents your Henley team has shared with you."
            : `${totalDocs} ${totalDocs === 1 ? "document" : "documents"} across ${projects.length} ${projects.length === 1 ? "project" : "projects"}.`
        }
      />
      <div className="space-y-6 p-6">
        <div className="flex md:flex-wrap items-center gap-1.5 overflow-x-auto md:overflow-visible touch-scroll">
          <Link
            href={filterHref()}
            className={`hh-badge !ml-0 ${!kindFilter ? "" : "opacity-60 hover:opacity-100"}`}
          >
            All
          </Link>
          {KINDS.filter((k) => role !== "SUB" || SUB_KINDS.includes(k)).map((k) => (
            <Link
              key={k}
              href={filterHref(k)}
              className={`hh-badge !ml-0 ${kindFilter === k ? "" : "opacity-60 hover:opacity-100"}`}
            >
              {k.toLowerCase()}
            </Link>
          ))}
        </div>

        {canUpload && (
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div>
              <h2 className="hh-label">Upload documents</h2>
              <p className="hh-caption mt-1">Files are stored per project. Mark them client-visible to share through the portal.</p>
            </div>
            <form action={uploadDocuments} className="grid gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-4">
                <label className="hh-label block mb-1.5">Project</label>
                <select name="projectId" className="input" required>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.client.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Kind</label>
                <select name="kind" className="input" defaultValue="OTHER" required>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{k.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="hh-label block mb-1.5">Files</label>
                <input type="file" name="files" multiple required className="input input-file" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 pb-2">
                <input type="checkbox" name="clientVisible" id="clientVisible" />
                <label htmlFor="clientVisible" className="hh-secondary cursor-pointer select-none">Visible to client</label>
              </div>
              <div className="md:col-span-1">
                <button className="btn btn-primary w-full justify-center" type="submit">Upload</button>
              </div>
            </form>
          </section>
        )}

        {projects.length === 0 && (
          <div className="hh-panel p-6 hh-secondary">No projects to show files for.</div>
        )}

        {projects.map((p) => {
          const logPhotos = p.dailyLogs.flatMap((l) => {
            try {
              return l.photos ? (JSON.parse(l.photos) as string[]) : [];
            } catch {
              return [];
            }
          });
          if (role === "CLIENT" && p.documents.length === 0 && logPhotos.length === 0) return null;
          return (
            <section key={p.id} className="hh-panel p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h2 className="hh-primary">
                    <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  </h2>
                  <div className="hh-secondary mt-0.5">{p.client.name}</div>
                </div>
                <span className="hh-badge">{p.documents.length} {p.documents.length === 1 ? "file" : "files"}</span>
              </div>

              <ul>
                {p.documents.length === 0 && (
                  <li className="py-1 hh-secondary">No documents{kindFilter ? " of this kind" : ""} yet.</li>
                )}
                {p.documents.map((d) => (
                  <li key={d.id} className="hh-row hh-row--flat">
                    <span className={`hh-dot ${kindDot(d.kind)}`} />
                    <div className="min-w-0 flex-1">
                      {d.storageKey || d.url ? (
                        <a
                          href={d.storageKey ? `/api/files/${d.id}` : d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hh-primary truncate block"
                        >
                          {d.name}
                        </a>
                      ) : (
                        <span className="hh-primary truncate block">{d.name} <span className="hh-caption">(no file)</span></span>
                      )}
                      <div className="hh-secondary mt-0.5">
                        {d.kind.toLowerCase()} · {formatBytes(d.sizeBytes)}
                        {d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""} · {formatRelative(d.createdAt)}
                      </div>
                    </div>
                    {d.clientVisible && isInternal(role) && (
                      <span className="hh-badge hh-badge--success !ml-0">visible to client</span>
                    )}
                    {canManage && (
                      <span className="flex items-center gap-1 shrink-0">
                        <form action={toggleVisibility}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="btn btn-ghost text-xs" type="submit">
                            {d.clientVisible ? "Hide from client" : "Share with client"}
                          </button>
                        </form>
                        <form action={deleteDocument}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="btn btn-ghost text-xs" type="submit">Delete</button>
                        </form>
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {logPhotos.length > 0 && (
                <div>
                  <hr className="hh-divider" />
                  <h3 className="hh-label">Photos from daily logs</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {logPhotos.slice(0, 18).map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative block aspect-square w-16 h-16 md:w-20 md:h-20 overflow-hidden rounded-lg border border-glass-border bg-row-bg"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Site photo ${idx + 1}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
